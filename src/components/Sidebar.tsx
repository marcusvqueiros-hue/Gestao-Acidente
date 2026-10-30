import { Activity, ClipboardList, LayoutDashboard, LogOut, Scale, Users } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useFiltros } from "../lib/filters";
import { BASES, GERENCIAS, MESES } from "../types";
import { listaCoordenadores } from "../lib/coordenacao";
import { listaGerentes } from "../lib/equipes";
import { Chips, Logo } from "./ui";

export type Page = "painel" | "taxas" | "comparativo" | "registros" | "usuarios";

const ITENS: { id: Page; label: string; icon: typeof Activity; admin?: boolean }[] = [
  { id: "painel", label: "Painel", icon: LayoutDashboard },
  { id: "taxas", label: "Taxas", icon: Activity },
  { id: "comparativo", label: "Comparativo", icon: Scale },
  { id: "registros", label: "Registros", icon: ClipboardList },
  { id: "usuarios", label: "Usuários", icon: Users, admin: true },
];

export default function Sidebar({ page, onNav, open }: { page: Page; onNav: (p: Page) => void; open: boolean }) {
  const { user, logout, admin, perfil } = useAuth();
  const { filtros, toggle, limpar, ativos, anosDisponiveis } = useFiltros();

  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="brand">
        <Logo height={40} />
        <small>Gestão de Acidentalidade</small>
      </div>

      <nav className="nav" aria-label="Principal">
        {ITENS.filter((i) => !i.admin || admin).map(({ id, label, icon: Icon }) => (
          <button key={id} className={page === id ? "on" : ""} onClick={() => onNav(id)} aria-current={page === id ? "page" : undefined}>
            <Icon size={17} /> {label}
          </button>
        ))}
      </nav>

      <div className="side-scroll">
        <div className="side-title">
          Filtros {ativos > 0 && <button onClick={limpar}>Limpar ({ativos})</button>}
        </div>
        <div className="fgroup">
          <span>Ano</span>
          <Chips options={anosDisponiveis} selected={filtros.anos} onToggle={(v) => toggle("anos", v)} />
        </div>
        <div className="fgroup">
          <span>Mês</span>
          <Chips options={MESES.map((_, i) => i + 1)} selected={filtros.meses} onToggle={(v) => toggle("meses", v)} label={(m) => MESES[m - 1]} />
        </div>
        <div className="fgroup">
          <span>Base</span>
          <Chips options={BASES} selected={filtros.bases} onToggle={(v) => toggle("bases", v)} />
        </div>
        <div className="fgroup">
          <span>Gerência</span>
          <Chips options={GERENCIAS} selected={filtros.gerencias} onToggle={(v) => toggle("gerencias", v)} />
        </div>
        <div className="fgroup">
          <span>Coordenador</span>
          <Chips options={listaCoordenadores()} selected={filtros.coordenadores} onToggle={(v) => toggle("coordenadores", v)} />
        </div>
        {listaGerentes().length > 0 && (
          <div className="fgroup">
            <span>Gerente</span>
            <Chips options={listaGerentes()} selected={filtros.gerentes} onToggle={(v) => toggle("gerentes", v)} />
          </div>
        )}
      </div>

      <div className="side-foot">
        <div className="who">
          <div className="avatar">{user?.[1]?.toUpperCase()}</div>
          <div className="who-text">
            <b>{user}</b>
            <small>{admin ? "Administrador" : perfil === "registrador" ? "Registrador" : "Leitor"}</small>
          </div>
          <button className="icon-btn" onClick={logout} aria-label="Sair" title="Sair">
            <LogOut size={17} />
          </button>
        </div>
        <p className="dev">Desenvolvido por<br /><b>Marcus Vinicius Silva Queiros</b></p>
      </div>
    </aside>
  );
}
