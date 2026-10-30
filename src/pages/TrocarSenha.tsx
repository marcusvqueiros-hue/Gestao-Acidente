import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Lock, LogOut } from "lucide-react";
import { useAuth } from "../lib/auth";
import { Logo } from "../components/ui";

/** Primeiro acesso: o usuário cria a própria senha antes de entrar no sistema. */
export default function TrocarSenha() {
  const { user, definirSenha, logout } = useAuth();
  const [nova, setNova] = useState("");
  const [conf, setConf] = useState("");
  const [show, setShow] = useState(false);
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (nova !== conf) return setErro("As senhas não são iguais.");
    setBusy(true);
    setErro("");
    const msg = await definirSenha(nova);
    if (msg) {
      setErro(msg);
      setBusy(false);
    }
  }

  return (
    <div className="lg">
      <div className="lg-aurora" aria-hidden>
        <i /><i /><i />
      </div>
      <main className="lg-wrap" style={{ justifyContent: "center" }}>
        <div className="lg-side">
          <form className="lg-card" onSubmit={submit}>
            <div className="lg-logo" style={{ marginBottom: 16 }}><Logo height={56} tema="escuro" /></div>
            <div className="lg-head">
              <h2>Crie sua senha</h2>
              <p>{user}, este é o seu primeiro acesso. Defina uma senha pessoal para continuar.</p>
            </div>
            <div className="lg-field">
              <label htmlFor="ns">Nova senha</label>
              <div className="lg-input">
                <Lock size={17} />
                <input id="ns" type={show ? "text" : "password"} value={nova} onChange={(e) => setNova(e.target.value)} placeholder="Mínimo de 6 caracteres" autoComplete="new-password" autoFocus />
                <button type="button" className="lg-eye" onClick={() => setShow((s) => !s)} aria-label={show ? "Ocultar senha" : "Mostrar senha"}>
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            <div className="lg-field">
              <label htmlFor="cs">Repita a nova senha</label>
              <div className="lg-input">
                <Lock size={17} />
                <input id="cs" type={show ? "text" : "password"} value={conf} onChange={(e) => setConf(e.target.value)} autoComplete="new-password" />
              </div>
            </div>
            {erro && <div className="lg-err" role="alert">{erro}</div>}
            <button className="lg-btn" disabled={busy || !nova || !conf}>
              <span>{busy ? "Salvando…" : "Salvar e entrar"}</span>
            </button>
            <button type="button" className="lg-foot" style={{ all: "unset", cursor: "pointer", marginTop: 14, display: "inline-flex", gap: 6, alignItems: "center", opacity: 0.8 }} onClick={logout}>
              <LogOut size={14} /> Sair
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
