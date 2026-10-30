import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { emailDe, normalizaUsuario, supabase } from "./supabase";

export type Perfil = "admin" | "registrador" | "leitor";
export interface Usuario {
  user: string;
  perfil: Perfil;
  hash?: string; // só no modo local
}

/* ====================== modo local (sem banco configurado) ======================
   Autenticação apenas no navegador: serve como barreira de acesso na interface, mas não protege dados. */
const ADMIN_USER = "marcusqueiros";
const ADMIN_NAME = "@MarcusQueiros";
const ADMIN_HASH = "7c81dbc7a2026bc7359cf9e5e283619c0fcd0f8f2e46458ca3d6e16db79bfef7";
const SESSION_KEY = "cgb.session";
const USERS_KEY = "cgb.users";
const SESSION_MS = 12 * 3600e3;

/** SHA-256 em JS puro: `crypto.subtle` não existe em páginas http (ex.: teste pela rede local no celular). */
export function sha256Js(msg: string): string {
  const primes: number[] = [];
  for (let n = 2; primes.length < 64; n++) if (primes.every((p) => n % p)) primes.push(n);
  const K = primes.map((p) => Math.floor((Math.cbrt(p) % 1) * 2 ** 32));
  const h = primes.slice(0, 8).map((p) => Math.floor((Math.sqrt(p) % 1) * 2 ** 32));
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  const bytes = new TextEncoder().encode(msg);
  const buf = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  buf.set(bytes);
  buf[bytes.length] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(buf.length - 8, Math.floor((bytes.length * 8) / 2 ** 32));
  dv.setUint32(buf.length - 4, (bytes.length * 8) >>> 0);
  const w = new Uint32Array(64);
  for (let off = 0; off < buf.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, hh].forEach((v, i) => (h[i] = (h[i] + v) >>> 0));
  }
  return h.map((x) => x.toString(16).padStart(8, "0")).join("");
}

async function sha256(text: string) {
  try {
    if (globalThis.crypto?.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch {
    /* cai para a versão em JS */
  }
  return sha256Js(text);
}

function lerUsuariosLocal(): Usuario[] {
  try {
    const l = JSON.parse(localStorage.getItem(USERS_KEY) ?? "[]");
    return Array.isArray(l) ? l : [];
  } catch {
    return [];
  }
}
const gravarUsuariosLocal = (l: Usuario[]) => {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(l));
  } catch {
    /* ignora */
  }
};

interface Sessao {
  user: string;
  perfil: Perfil;
  /** primeiro acesso (ou senha redefinida por um administrador): precisa criar a própria senha */
  trocarSenha?: boolean;
}

function lerSessaoLocal(): Sessao | null {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
    if (!s || s.exp <= Date.now()) return null;
    if (normalizaUsuario(s.user) === ADMIN_USER) return { user: ADMIN_NAME, perfil: "admin" };
    const u = lerUsuariosLocal().find((x) => normalizaUsuario(x.user) === normalizaUsuario(s.user));
    return u ? { user: u.user, perfil: u.perfil } : null;
  } catch {
    return null;
  }
}

/* ====================== contexto ====================== */
interface AuthCtx {
  user: string | null;
  perfil: Perfil | null;
  admin: boolean;
  /** pode cadastrar, editar e excluir registros (admin e registrador) */
  registra: boolean;
  carregando: boolean;
  nuvem: boolean;
  /** devolve a mensagem de erro, ou null quando entrou */
  login: (user: string, pass: string) => Promise<string | null>;
  logout: () => void;
  usuarios: Usuario[];
  addUsuario: (user: string, pass: string, perfil: Perfil) => Promise<string | null>;
  removeUsuario: (user: string) => Promise<string | null>;
  redefinirSenha: (user: string, pass: string) => Promise<string | null>;
  alterarPerfil: (user: string, perfil: Perfil) => Promise<string | null>;
  trocarSenha: boolean;
  /** define a senha própria do usuário logado e libera o acesso */
  definirSenha: (nova: string) => Promise<string | null>;
}

const Ctx = createContext<AuthCtx>(null!);
export const useAuth = () => useContext(Ctx);

async function chamarApi(metodo: "POST" | "DELETE" | "PATCH", corpo: object): Promise<string | null> {
  if (!supabase) return "Banco não configurado";
  const { data } = await supabase.auth.getSession();
  try {
    const r = await fetch("/api/usuarios", {
      method: metodo,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: JSON.stringify(corpo),
    });
    if (r.ok) return null;
    const j = await r.json().catch(() => ({}));
    return j.erro ?? `Falha na operação (${r.status})`;
  } catch {
    return "Sem conexão com o servidor.";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const nuvem = !!supabase;
  const [sessao, setSessao] = useState<Sessao | null>(nuvem ? null : lerSessaoLocal);
  const [carregando, setCarregando] = useState(nuvem);
  const [usuarios, setUsuarios] = useState<Usuario[]>(nuvem ? [] : lerUsuariosLocal);

  const buscarPerfil = useCallback(async (id: string): Promise<Sessao | null> => {
    const { data } = await supabase!.from("perfis").select("usuario, perfil").eq("id", id).maybeSingle();
    if (!data) return null;
    const { data: u } = await supabase!.auth.getUser();
    const perfil = data.perfil as Perfil;
    return { user: data.usuario, perfil, trocarSenha: perfil !== "admin" && u.user?.user_metadata?.senha_definida !== true };
  }, []);

  const carregarUsuarios = useCallback(async () => {
    const { data } = await supabase!.from("perfis").select("usuario, perfil").order("usuario");
    setUsuarios((data ?? []).map((p) => ({ user: p.usuario, perfil: p.perfil as Perfil })));
  }, []);

  // modo nuvem: acompanha a sessão do Supabase
  useEffect(() => {
    if (!supabase) return;
    let vivo = true;
    const aplicar = async (id: string | undefined) => {
      if (!id) {
        if (vivo) setSessao(null);
        return;
      }
      const s = await buscarPerfil(id);
      if (!vivo) return;
      if (!s) {
        await supabase!.auth.signOut();
        setSessao(null);
      } else setSessao(s);
    };
    supabase.auth.getSession().then(({ data }) => aplicar(data.session?.user.id).finally(() => vivo && setCarregando(false)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setTimeout(() => aplicar(session?.user.id), 0); // fora do callback, para não travar o cliente
    });
    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, [buscarPerfil]);

  useEffect(() => {
    if (supabase && sessao?.perfil === "admin") carregarUsuarios();
  }, [sessao, carregarUsuarios]);

  const login = useCallback(
    async (u: string, p: string): Promise<string | null> => {
      const nome = normalizaUsuario(u);
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ email: emailDe(nome), password: p });
        if (error || !data.user) {
          return /network|fetch|failed/i.test(error?.message ?? "") ? "Sem conexão com o servidor." : "Usuário ou senha incorretos.";
        }
        const s = await buscarPerfil(data.user.id);
        if (!s) {
          await supabase.auth.signOut();
          return "Seu acesso ainda não foi liberado. Fale com um administrador.";
        }
        setSessao(s);
        return null;
      }
      let s: Sessao | null = null;
      if (nome === ADMIN_USER) {
        if ((await sha256("cgb:" + p)) === ADMIN_HASH) s = { user: ADMIN_NAME, perfil: "admin" };
      } else {
        const achado = lerUsuariosLocal().find((x) => normalizaUsuario(x.user) === nome);
        if (achado && (await sha256(`cgb:${nome}:${p}`)) === achado.hash) s = { user: achado.user, perfil: achado.perfil };
      }
      if (!s) return "Usuário ou senha incorretos.";
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ user: s.user, exp: Date.now() + SESSION_MS }));
      } catch {
        /* ignora */
      }
      setSessao(s);
      return null;
    },
    [buscarPerfil],
  );

  const logout = useCallback(() => {
    if (supabase) supabase.auth.signOut();
    else
      try {
        localStorage.removeItem(SESSION_KEY);
      } catch {
        /* ignora */
      }
    setSessao(null);
  }, []);

  const addUsuario = useCallback(
    async (user: string, pass: string, perfil: Perfil): Promise<string | null> => {
      const nome = normalizaUsuario(user);
      if (!/^[a-z0-9._-]{3,30}$/.test(nome)) return "Use de 3 a 30 letras, números, ponto, hífen ou sublinhado.";
      if (pass.length < 4) return "A senha precisa ter ao menos 4 caracteres.";
      if (supabase) {
        const erro = await chamarApi("POST", { usuario: "@" + nome, senha: pass, perfil });
        if (!erro) await carregarUsuarios();
        return erro;
      }
      if (nome === ADMIN_USER || lerUsuariosLocal().some((x) => normalizaUsuario(x.user) === nome)) return "Esse usuário já existe.";
      const novo: Usuario = { user: "@" + nome, hash: await sha256(`cgb:${nome}:${pass}`), perfil };
      const lista = [...lerUsuariosLocal(), novo];
      gravarUsuariosLocal(lista);
      setUsuarios(lista);
      return null;
    },
    [carregarUsuarios],
  );

  const removeUsuario = useCallback(
    async (user: string): Promise<string | null> => {
      if (supabase) {
        const erro = await chamarApi("DELETE", { usuario: user });
        if (!erro) await carregarUsuarios();
        return erro;
      }
      const lista = lerUsuariosLocal().filter((x) => normalizaUsuario(x.user) !== normalizaUsuario(user));
      gravarUsuariosLocal(lista);
      setUsuarios(lista);
      return null;
    },
    [carregarUsuarios],
  );

  const redefinirSenha = useCallback(async (user: string, pass: string): Promise<string | null> => {
    if (pass.length < 4) return "A senha precisa ter ao menos 4 caracteres.";
    if (supabase) return chamarApi("PATCH", { usuario: user, senha: pass });
    const nome = normalizaUsuario(user);
    const hash = await sha256(`cgb:${nome}:${pass}`);
    const lista = lerUsuariosLocal().map((x) => (normalizaUsuario(x.user) === nome ? { ...x, hash } : x));
    gravarUsuariosLocal(lista);
    setUsuarios(lista);
    return null;
  }, []);

  const alterarPerfil = useCallback(
    async (user: string, perfil: Perfil): Promise<string | null> => {
      if (supabase) {
        const erro = await chamarApi("PATCH", { usuario: user, perfil });
        if (!erro) await carregarUsuarios();
        return erro;
      }
      const nome = normalizaUsuario(user);
      const lista = lerUsuariosLocal().map((x) => (normalizaUsuario(x.user) === nome ? { ...x, perfil } : x));
      gravarUsuariosLocal(lista);
      setUsuarios(lista);
      return null;
    },
    [carregarUsuarios],
  );

  const definirSenha = useCallback(async (nova: string): Promise<string | null> => {
    if (nova.length < 6) return "A nova senha precisa ter ao menos 6 caracteres.";
    if (!supabase) return "Banco não configurado";
    const { error } = await supabase.auth.updateUser({ password: nova, data: { senha_definida: true } });
    if (error) return /same|different/i.test(error.message) ? "Escolha uma senha diferente da atual." : "Não foi possível salvar a senha. Tente novamente.";
    setSessao((s) => (s ? { ...s, trocarSenha: false } : s));
    return null;
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user: sessao?.user ?? null,
      perfil: sessao?.perfil ?? null,
      admin: sessao?.perfil === "admin",
      registra: sessao?.perfil === "admin" || sessao?.perfil === "registrador",
      carregando,
      nuvem,
      login,
      logout,
      usuarios,
      addUsuario,
      removeUsuario,
      redefinirSenha,
      alterarPerfil,
      trocarSenha: !!sessao?.trocarSenha,
      definirSenha,
    }),
    [sessao, carregando, nuvem, usuarios, login, logout, addUsuario, removeUsuario, redefinirSenha, alterarPerfil, definirSenha],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
