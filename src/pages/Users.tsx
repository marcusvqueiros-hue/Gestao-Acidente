import { useRef, useState, type FormEvent } from "react";
import { Check, FileUp, Pencil, Search, Trash2, UserPlus, X } from "lucide-react";
import { useAuth, type Perfil } from "../lib/auth";
import { Card, Toast } from "../components/ui";

const ROTULO: Record<Perfil, string> = { admin: "Administrador", registrador: "Registrador", leitor: "Leitor" };

const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");
const chave = (t: string) => sem(String(t ?? "")).toUpperCase().replace(/[^A-Z0-9]/g, "");
const pronto = (v: unknown) => {
  const t = String(v ?? "").trim();
  return t && !t.startsWith("=") ? t : "";
};
const maiuscula = (p: string) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();

/** Lê a planilha de acessos: CHAPA, NOME, USUARIO, SENHA (e, opcionalmente, PERFIL). Sem USUARIO/SENHA, aplica a regra padrão. */
function linhasDaPlanilha(linhas: Record<string, unknown>[]) {
  return linhas.flatMap((l) => {
    const c: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(l)) c[chave(k)] = v;
    const nome = String(c.NOME ?? "").trim();
    const chapa = String(c.CHAPA ?? "").trim();
    if (!nome && !pronto(c.USUARIO)) return [];
    const p = sem(nome).split(/\s+/).filter(Boolean);
    const usuario = pronto(c.USUARIO) || (p.length ? "@" + maiuscula(p[0]) + maiuscula(p[p.length - 1]) : "");
    const senha = pronto(c.SENHA) || (chapa && nome ? "Sinistro@" + chapa + nome.charAt(0).toLowerCase() : "");
    const bruto = chave(String(c.PERFIL ?? ""));
    const perfil: Perfil = bruto.startsWith("ADM") ? "admin" : bruto.startsWith("REGIS") ? "registrador" : "leitor";
    return [{ usuario, senha, perfil }];
  });
}

export default function Users() {
  const { usuarios, addUsuario, removeUsuario, redefinirSenha, alterarPerfil, admin, nuvem } = useAuth();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [perfil, setPerfil] = useState<Perfil>("leitor");
  const [erro, setErro] = useState("");
  const [toast, setToast] = useState("");
  const [lote, setLote] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [edPerfil, setEdPerfil] = useState<Perfil>("leitor");
  const [edSenha, setEdSenha] = useState("");
  const arquivo = useRef<HTMLInputElement>(null);

  if (!admin) return <Card><div className="empty">Apenas administradores podem gerenciar usuários.</div></Card>;

  async function criar(e: FormEvent) {
    e.preventDefault();
    const r = await addUsuario(user, pass, perfil);
    setErro(r ?? "");
    if (!r) {
      setUser("");
      setPass("");
      setToast("Usuário criado");
    }
  }

  async function importar(f: File) {
    setOcupado(true);
    setLote("Lendo a planilha…");
    try {
      const X = await import("xlsx");
      const wb = X.read(await f.arrayBuffer());
      const ws = wb.Sheets[wb.SheetNames[0]];
      const itens = linhasDaPlanilha(X.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" }));
      if (!itens.length) {
        setLote("Nenhum usuário encontrado. A planilha precisa das colunas NOME e CHAPA (ou USUARIO e SENHA).");
        return;
      }
      let criados = 0;
      const jaExistem: string[] = [];
      const falhas: string[] = [];
      for (let i = 0; i < itens.length; i++) {
        const it = itens[i];
        setLote(`Importando ${i + 1} de ${itens.length}…`);
        const r = await addUsuario(it.usuario, it.senha, it.perfil);
        if (!r) criados++;
        else if (/já existe/i.test(r)) jaExistem.push(it.usuario);
        else falhas.push(`${it.usuario}: ${r}`);
      }
      setLote(`${criados} criado(s), ${jaExistem.length} já existia(m)${falhas.length ? `, ${falhas.length} com erro — ${falhas.slice(0, 3).join(" | ")}` : ""}.`);
    } catch (e) {
      setLote("Não foi possível ler a planilha: " + (e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  async function excluir(nome: string) {
    if (!confirm(`Excluir o usuário ${nome}?`)) return;
    const e = await removeUsuario(nome);
    setToast(e ?? "Usuário excluído");
  }

  function editar(u: { user: string; perfil: Perfil }) {
    setEditando(u.user);
    setEdPerfil(u.perfil);
    setEdSenha("");
  }

  async function salvar(u: { user: string; perfil: Perfil }) {
    if (edSenha && edSenha.length < 4) return setToast("A senha precisa ter ao menos 4 caracteres");
    if (edPerfil !== u.perfil) {
      const e = await alterarPerfil(u.user, edPerfil);
      if (e) return setToast(e);
    }
    if (edSenha) {
      const e = await redefinirSenha(u.user, edSenha);
      if (e) return setToast(e);
    }
    setEditando(null);
    setToast("Usuário atualizado");
  }

  const termo = sem(busca).toLowerCase().replace(/^@/, "").trim();
  const visiveis = usuarios.filter((u) => !termo || sem(u.user).toLowerCase().includes(termo));
  const admins = visiveis.filter((u) => u.perfil === "admin");
  const leitores = visiveis.filter((u) => u.perfil !== "admin");

  const tabela = (lista: typeof usuarios, principal: boolean) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Usuário</th><th>Perfil</th><th /></tr>
        </thead>
        <tbody>
          {principal && !nuvem && (!termo || "marcusqueiros".includes(termo)) && (
            <tr>
              <td><b>@MarcusQueiros</b></td>
              <td><span className="badge" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}>{ROTULO.admin}</span></td>
              <td className="num"><small style={{ color: "var(--muted)" }}>principal</small></td>
            </tr>
          )}
          {lista.map((u) =>
            editando === u.user ? (
              <tr key={u.user}>
                <td><b>{u.user}</b></td>
                <td colSpan={2}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <select className="select" value={edPerfil} onChange={(e) => setEdPerfil(e.target.value as Perfil)} aria-label="Perfil">
                      <option value="leitor">Leitor</option>
                      <option value="registrador">Registrador</option>
                      <option value="admin">Administrador</option>
                    </select>
                    <input className="input" type="text" value={edSenha} onChange={(e) => setEdSenha(e.target.value)} placeholder="Nova senha (opcional)" autoComplete="off" style={{ minWidth: 170 }} />
                    <button className="icon-btn" style={{ display: "inline-grid" }} onClick={() => salvar(u)} aria-label="Salvar" title="Salvar"><Check size={16} /></button>
                    <button className="icon-btn" style={{ display: "inline-grid" }} onClick={() => setEditando(null)} aria-label="Cancelar" title="Cancelar"><X size={16} /></button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={u.user}>
                <td><b>{u.user}</b></td>
                <td><span className="badge" style={{ background: u.perfil === "admin" ? "var(--brand-soft)" : "var(--bg)", color: u.perfil === "admin" ? "var(--brand)" : "var(--muted)" }}>{ROTULO[u.perfil]}</span></td>
                <td className="num" style={{ whiteSpace: "nowrap" }}>
                  <button className="icon-btn" style={{ display: "inline-grid" }} onClick={() => editar(u)} aria-label={`Editar ${u.user}`} title="Editar perfil ou senha"><Pencil size={16} /></button>
                  <button className="icon-btn" style={{ display: "inline-grid" }} onClick={() => excluir(u.user)} aria-label={`Excluir ${u.user}`} title="Excluir"><Trash2 size={16} /></button>
                </td>
              </tr>
            ),
          )}
          {!lista.length && !(principal && !nuvem) && (
            <tr><td colSpan={3}><small style={{ color: "var(--muted)" }}>Nenhum usuário{termo ? " encontrado" : ""}.</small></td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="grid">
      <Card title="Novo usuário" className="s5">
        <form onSubmit={criar} className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
          <div className="field">
            <label htmlFor="nu">Usuário</label>
            <input id="nu" className="input" value={user} onChange={(e) => setUser(e.target.value)} placeholder="@nome.sobrenome" autoCapitalize="none" autoCorrect="off" autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="np">Senha</label>
            <input id="np" className="input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="field">
            <label htmlFor="nf">Perfil</label>
            <select id="nf" className="select" value={perfil} onChange={(e) => setPerfil(e.target.value as Perfil)}>
              <option value="leitor">Leitor — apenas consulta</option>
              <option value="registrador">Registrador — consulta e registro de acidentes</option>
              <option value="admin">Administrador — acesso total, taxas e usuários</option>
            </select>
          </div>
          {erro && <span className="err" role="alert" style={{ color: "var(--bad)", fontSize: 12 }}>{erro}</span>}
          <button className="btn primary" disabled={!user || !pass}><UserPlus size={16} /> Criar usuário</button>
        </form>
      </Card>

      <div className="s7" style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
        <Card title="Administradores" extra={`${admins.length + (!nuvem ? 1 : 0)} no total`}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
            <label style={{ position: "relative", flex: "1 1 220px" }}>
              <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
              <input className="input" style={{ paddingLeft: 36, width: "100%" }} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar por nome…" aria-label="Filtrar usuários por nome" autoComplete="off" />
              {busca && (
                <button type="button" className="icon-btn" style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)" }} onClick={() => setBusca("")} aria-label="Limpar filtro" title="Limpar filtro"><X size={14} /></button>
              )}
            </label>
            <input ref={arquivo} type="file" accept=".xlsx,.xlsm,.xls" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = ""; }} />
            <button className="btn" disabled={ocupado} onClick={() => arquivo.current?.click()}><FileUp size={16} /> Importar planilha</button>
          </div>
          <small style={{ color: "var(--muted)", display: "block", marginBottom: 12 }}>Planilha com as colunas CHAPA, NOME, USUARIO e SENHA (PERFIL opcional; sem ele, todos entram como Leitor). Quem já existe é ignorado.</small>
          {lote && <div className="foto-prog" role="status" style={{ marginBottom: 12 }}>{lote}</div>}
          {tabela(admins, true)}
        </Card>

        <Card title="Leitores e demais perfis" extra={`${leitores.length} no total`}>
          {tabela(leitores, false)}
          <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 12 }}>
            {nuvem ? "Os usuários ficam no banco de dados e valem em qualquer aparelho. " : "Os usuários ficam salvos neste navegador. "}Leitores veem painel, taxas e comparativo, mas não cadastram, editam, excluem nem importam dados. Só administradores acessam Registros e Usuários.
          </p>
        </Card>
      </div>
      {toast && <Toast msg={toast} onDone={() => setToast("")} />}
    </div>
  );
}
