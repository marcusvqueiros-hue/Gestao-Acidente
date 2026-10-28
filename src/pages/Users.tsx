import { useState, type FormEvent } from "react";
import { KeyRound, Trash2, UserPlus } from "lucide-react";
import { useAuth, type Perfil } from "../lib/auth";
import { Card, Toast } from "../components/ui";

const ROTULO: Record<Perfil, string> = { admin: "Administrador", registrador: "Registrador", leitor: "Leitor" };

export default function Users() {
  const { usuarios, addUsuario, removeUsuario, redefinirSenha, admin, nuvem } = useAuth();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [perfil, setPerfil] = useState<Perfil>("leitor");
  const [erro, setErro] = useState("");
  const [toast, setToast] = useState("");

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

  async function excluir(nome: string) {
    if (!confirm(`Excluir o usuário ${nome}?`)) return;
    const e = await removeUsuario(nome);
    setToast(e ?? "Usuário excluído");
  }

  async function trocar(u: string) {
    const nova = prompt(`Nova senha para ${u} (mínimo 4 caracteres):`);
    if (nova == null) return;
    if (nova.length < 4) return setToast("A senha precisa ter ao menos 4 caracteres");
    const e = await redefinirSenha(u, nova);
    setToast(e ?? "Senha redefinida");
  }

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

      <Card title="Usuários" extra={`${nuvem ? usuarios.length : usuarios.length + 1} no total`} className="s7">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Usuário</th><th>Perfil</th><th /></tr>
            </thead>
            <tbody>
              {!nuvem && (

                <tr>

                  <td><b>@MarcusQueiros</b></td>

                  <td><span className="badge" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}>{ROTULO.admin}</span></td>

                  <td className="num"><small style={{ color: "var(--muted)" }}>principal</small></td>

                </tr>

              )}
              {usuarios.map((u) => (
                <tr key={u.user}>
                  <td><b>{u.user}</b></td>
                  <td><span className="badge" style={{ background: u.perfil === "admin" ? "var(--brand-soft)" : "var(--bg)", color: u.perfil === "admin" ? "var(--brand)" : "var(--muted)" }}>{ROTULO[u.perfil]}</span></td>
                  <td className="num" style={{ whiteSpace: "nowrap" }}>
                    <button className="icon-btn" style={{ display: "inline-grid" }} onClick={() => trocar(u.user)} aria-label={`Redefinir senha de ${u.user}`} title="Redefinir senha"><KeyRound size={16} /></button>
                    <button className="icon-btn" style={{ display: "inline-grid" }} onClick={() => excluir(u.user)} aria-label={`Excluir ${u.user}`} title="Excluir"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 12 }}>
          {nuvem ? "Os usuários ficam no banco de dados e valem em qualquer aparelho. " : "Os usuários ficam salvos neste navegador. "}Leitores veem painel, taxas, comparativo e a lista de registros, mas não cadastram, editam, excluem nem importam dados.
        </p>
      </Card>
      {toast && <Toast msg={toast} onDone={() => setToast("")} />}
    </div>
  );
}
