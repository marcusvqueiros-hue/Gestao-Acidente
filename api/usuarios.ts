// Função serverless (Vercel): gerencia usuários com a chave de serviço, que NUNCA vai para o navegador.
// Variáveis necessárias no Vercel: SUPABASE_SERVICE_ROLE_KEY (e SUPABASE_URL, ou usa VITE_SUPABASE_URL).
// Somente administradores autenticados podem chamar.

const URL_BASE = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const SERVICO = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const DOMINIO = "cgb.invalid";

const norm = (u: string) => String(u ?? "").trim().replace(/^@/, "").toLowerCase();

async function rest(caminho: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  return fetch(`${URL_BASE}${caminho}`, {
    ...init,
    headers: { apikey: SERVICO, Authorization: `Bearer ${SERVICO}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

async function quemChama(req: any): Promise<{ id: string } | null> {
  const token = String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const r = await fetch(`${URL_BASE}/auth/v1/user`, { headers: { apikey: SERVICO, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const u = await r.json();
  const p = await rest(`/rest/v1/perfis?id=eq.${u.id}&select=perfil`);
  const linhas = p.ok ? await p.json() : [];
  return linhas[0]?.perfil === "admin" ? { id: u.id } : null;
}

async function idDoUsuario(usuario: string): Promise<string | null> {
  const r = await rest(`/rest/v1/perfis?usuario=ilike.${encodeURIComponent("@" + norm(usuario))}&select=id`);
  const l = r.ok ? await r.json() : [];
  return l[0]?.id ?? null;
}

export default async function handler(req: any, res: any) {
  const responde = (status: number, corpo: object) => res.status(status).setHeader("Cache-Control", "no-store").json(corpo);

  if (!URL_BASE || !SERVICO) return responde(500, { erro: "Servidor sem SUPABASE_SERVICE_ROLE_KEY configurada." });
  if (!["POST", "DELETE", "PATCH"].includes(req.method)) return responde(405, { erro: "Método não permitido." });

  const admin = await quemChama(req);
  if (!admin) return responde(403, { erro: "Apenas administradores podem gerenciar usuários." });

  const corpo = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {};
  const nome = norm(corpo.usuario);
  if (!/^[a-z0-9._-]{3,30}$/.test(nome)) return responde(400, { erro: "Usuário inválido." });

  if (req.method === "POST") {
    const { senha, perfil } = corpo;
    if (!["admin", "registrador", "leitor"].includes(perfil)) return responde(400, { erro: "Perfil inválido." });
    if (typeof senha !== "string" || senha.length < 4) return responde(400, { erro: "A senha precisa ter ao menos 4 caracteres." });
    if (await idDoUsuario(nome)) return responde(409, { erro: "Esse usuário já existe." });

    const c = await rest("/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({ email: `${nome}@${DOMINIO}`, password: senha, email_confirm: true }),
    });
    const criado = await c.json().catch(() => ({}));
    if (!c.ok) return responde(400, { erro: criado.msg || criado.message || criado.error_description || "Não foi possível criar o usuário (veja o tamanho mínimo de senha no Supabase)." });

    const p = await rest("/rest/v1/perfis", { method: "POST", body: JSON.stringify({ id: criado.id, usuario: "@" + nome, perfil }) });
    if (!p.ok) {
      await rest(`/auth/v1/admin/users/${criado.id}`, { method: "DELETE" });
      return responde(500, { erro: "Falha ao registrar o perfil do usuário." });
    }
    return responde(200, { ok: true });
  }

  const id = await idDoUsuario(nome);
  if (!id) return responde(404, { erro: "Usuário não encontrado." });

  if (req.method === "DELETE") {
    if (id === admin.id) return responde(400, { erro: "Você não pode excluir o próprio usuário." });
    const d = await rest(`/auth/v1/admin/users/${id}`, { method: "DELETE" });
    return d.ok ? responde(200, { ok: true }) : responde(500, { erro: "Não foi possível excluir o usuário." });
  }

  // PATCH: alterar o perfil e/ou redefinir a senha
  const { senha, perfil } = corpo;
  if (perfil !== undefined) {
    if (!["admin", "registrador", "leitor"].includes(perfil)) return responde(400, { erro: "Perfil inválido." });
    if (id === admin.id && perfil !== "admin") return responde(400, { erro: "Você não pode rebaixar o próprio perfil." });
    const p = await rest(`/rest/v1/perfis?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ perfil }) });
    if (!p.ok) return responde(500, { erro: "Não foi possível alterar o perfil." });
    if (senha === undefined) return responde(200, { ok: true });
  }
  if (typeof senha !== "string" || senha.length < 4) return responde(400, { erro: "A senha precisa ter ao menos 4 caracteres." });
  const u = await rest(`/auth/v1/admin/users/${id}`, { method: "PUT", body: JSON.stringify({ password: senha, user_metadata: { senha_definida: false } }) });
  const j = await u.json().catch(() => ({}));
  return u.ok ? responde(200, { ok: true }) : responde(400, { erro: j.msg || j.message || "Não foi possível redefinir a senha." });
}
