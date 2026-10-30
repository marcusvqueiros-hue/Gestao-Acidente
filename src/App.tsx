import { useEffect, useMemo, useState } from "react";
import { Maximize2, Menu, Minimize2, Moon, Sun } from "lucide-react";
import { ThemeProvider, useTheme } from "./lib/theme";
import { AuthProvider, useAuth } from "./lib/auth";
import { DataProvider, useData } from "./lib/store";
import { FiltrosProvider } from "./lib/filters";
import { fmtData } from "./lib/stats";
import Foto, { FotoBotao } from "./components/Foto";
import Sidebar, { type Page } from "./components/Sidebar";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import { FiltroTags } from "./components/ui";
import Rates from "./pages/Rates";
import Compare from "./pages/Compare";
import Records from "./pages/Records";
import Users from "./pages/Users";

const TITULOS: Record<Page, string> = {
  painel: "Monitoramento de Eventos Acidentais",
  taxas: "Taxas de frequência e gravidade",
  comparativo: "Comparativo entre anos",
  registros: "Registro de acidentes",
  usuarios: "Usuários e perfis",
};

const fsEl = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
const fsDoc = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
const fullscreenOk = !!(fsEl.requestFullscreen || fsEl.webkitRequestFullscreen);

const fromHash = (): Page => {
  const h = location.hash.slice(1) as Page;
  return h in TITULOS ? h : "painel";
};

function Shell() {
  const { data, carregando, erro, recarregar } = useData();
  const [page, setPage] = useState<Page>(fromHash);
  const [menu, setMenu] = useState(false);
  const [max, setMax] = useState(false);
  const [foto, setFoto] = useState(false);
  const { mode, toggle } = useTheme();

  useEffect(() => {
    const on = () => !(fsDoc.fullscreenElement || fsDoc.webkitFullscreenElement) && setMax(false);
    document.addEventListener("fullscreenchange", on);
    document.addEventListener("webkitfullscreenchange", on);
    return () => {
      document.removeEventListener("fullscreenchange", on);
      document.removeEventListener("webkitfullscreenchange", on);
    };
  }, []);

  const toggleMax = () => {
    const next = !max;
    setMax(next);
    setMenu(false);
    try {
      if (next) {
        const p = (fsEl.requestFullscreen ?? fsEl.webkitRequestFullscreen)?.call(fsEl);
        if (p && typeof (p as Promise<void>).catch === "function") (p as Promise<void>).catch(() => {});
      } else if (fsDoc.fullscreenElement || fsDoc.webkitFullscreenElement) {
        (fsDoc.exitFullscreen ?? fsDoc.webkitExitFullscreen)?.call(fsDoc);
      }
    } catch {
      /* sem suporte: apenas oculta o menu */
    }
  };

  useEffect(() => {
    document.body.classList.toggle("lock", menu);
    if (!menu) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.classList.remove("lock");
    };
  }, [menu]);

  useEffect(() => {
    const on = () => setPage(fromHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const ultimoEvento = useMemo(() => data.registros.reduce((m, r) => (r.categoria === "acidente" && r.data > m ? r.data : m), ""), [data.registros]);

  const nav = (p: Page) => {
    location.hash = p;
    setMenu(false);
    window.scrollTo?.(0, 0);
  };

  return (
    <div className={`app ${max ? "max" : ""}`}>
      <Sidebar page={page} onNav={nav} open={menu} />
      <div className={`scrim ${menu ? "open" : ""}`} onClick={() => setMenu(false)} />
      <main className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setMenu(true)} aria-label="Abrir menu">
            <Menu size={22} />
          </button>
          <div className="grow">
            <h1>{TITULOS[page]}</h1>
            <p>Último evento acidental registrado: {ultimoEvento ? fmtData(ultimoEvento) : "—"}</p>
          </div>
          <div className="top-actions">
            {page === "painel" && <FotoBotao onClick={() => setFoto(true)} />}
            <button className="icon-btn" onClick={toggle} aria-label={mode === "dark" ? "Tema claro" : "Tema escuro"} title={mode === "dark" ? "Tema claro" : "Tema escuro"}>
              {mode === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className={`icon-btn max-btn ${fullscreenOk ? "" : "no-fs"}`} onClick={toggleMax} aria-label={max ? "Sair da tela cheia" : "Maximizar tela"} title={max ? "Sair da tela cheia" : "Maximizar tela"}>
              {max ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </header>
        {erro && (
          <div className="note" role="alert" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <span>Não foi possível carregar os dados do banco: {erro}</span>
            <button className="btn" onClick={() => recarregar()}>Tentar de novo</button>
          </div>
        )}
        {carregando && !erro && <div className="note" role="status">Carregando dados…</div>}
        {page !== "taxas" && <FiltroTags />}
        {page === "painel" && <Dashboard />}
        {foto && page === "painel" && <Foto onClose={() => setFoto(false)} />}
        {page === "taxas" && <Rates />}
        {page === "comparativo" && <Compare />}
        {page === "registros" && <Records />}
        {page === "usuarios" && <Users />}
      </main>
    </div>
  );
}

function Gate() {
  const { user, carregando } = useAuth();
  if (carregando) return <div className="splash" role="status" aria-label="Carregando" />;
  return user ? (
    <DataProvider>
      <FiltrosProvider>
        <Shell />
      </FiltrosProvider>
    </DataProvider>
  ) : (
    <Login />
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ThemeProvider>
  );
}
