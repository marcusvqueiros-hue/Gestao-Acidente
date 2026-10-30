import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Camera, Download, Package, X } from "lucide-react";
import { toBlob } from "html-to-image";
import { useData } from "../lib/store";
import { aplicar, FILTROS_VAZIOS, FiltrosFixos, useFiltros, type Filtros } from "../lib/filters";
import { BASES, GERENCIAS, MESES } from "../types";
import { fmtData } from "../lib/stats";
import { listaCoordenadores, coordenadorDe, SEM_COORDENADOR } from "../lib/coordenacao";
import { Logo } from "./ui";
import Dashboard from "../pages/Dashboard";

type Modo = "atual" | "base" | "gerencia" | "coordenador";
interface Alvo {
  nome: string; // para o arquivo
  rotulo: string; // para o título do slide
  filtros: Filtros;
}

const MODOS: { id: Modo; rotulo: string }[] = [
  { id: "atual", rotulo: "Painel atual" },
  { id: "base", rotulo: "Por base" },
  { id: "gerencia", rotulo: "Por gerência" },
  { id: "coordenador", rotulo: "Por coordenador" },
];

const limpo = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
const baixar = (blob: Blob, nome: string) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const larguraPara = (h: number) => Math.min(3200, Math.max(1600, Math.round((h * 16) / 9)));

function periodoTexto(f: Filtros) {
  const anos = f.anos.length ? [...f.anos].sort().join(", ") : "Todos os anos";
  const meses = f.meses.length ? [...f.meses].sort((a, b) => a - b).map((m) => MESES[m - 1]).join(", ") : "todos os meses";
  return `${anos} · ${meses}`;
}

/** Slide 16:9 do painel completo. A largura se ajusta para o conteúdo caber na proporção. */
function Slide({ alvo, onLargura, boxRef }: { alvo: Alvo; onLargura: (largura: number) => void; boxRef: RefObject<HTMLDivElement | null> }) {
  const { data } = useData();
  const dentro = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(1920);
  const ultimo = useMemo(() => {
    const regs = aplicar(data.registros.filter((r) => r.categoria === "acidente"), alvo.filtros);
    return regs.reduce((m, r) => (r.data > m ? r.data : m), "");
  }, [data, alvo]);

  // mede a altura natural do conteúdo e ajusta a largura para fechar 16:9
  useEffect(() => {
    let vivo = true;
    let n = 0;
    let t: ReturnType<typeof setTimeout>;
    const medir = () => {
      if (!vivo || !dentro.current) return;
      const nova = larguraPara(dentro.current.offsetHeight);
      setW((atual) => (Math.abs(nova - atual) > 6 ? nova : atual));
      if (n++ < 6) t = setTimeout(medir, 250);
    };
    t = setTimeout(medir, 120);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [alvo]);

  useEffect(() => onLargura(W), [W, onLargura]);

  return (
    <div ref={boxRef} className="slide" style={{ width: W, height: Math.round((W * 9) / 16) }}>
      <div ref={dentro} className="slide-in">
        <header className="slide-head">
          <Logo height={40} />
          <div className="grow">
            <h2>Monitoramento de Eventos Acidentais</h2>
            <p>{alvo.rotulo} · {periodoTexto(alvo.filtros)}</p>
          </div>
          <div className="slide-meta">
            <span>Último evento acidental registrado</span>
            <b>{ultimo ? fmtData(ultimo) : "—"}</b>
          </div>
        </header>
        <FiltrosFixos filtros={alvo.filtros}>
          <Dashboard compacto />
        </FiltrosFixos>
      </div>
    </div>
  );
}

export function FotoBotao({ onClick }: { onClick: () => void }) {
  return (
    <button className="icon-btn" onClick={onClick} aria-label="Fotografia do painel" title="Fotografia do painel (16:9)">
      <Camera size={18} />
    </button>
  );
}

export default function Foto({ onClose }: { onClose: () => void }) {
  const { data } = useData();
  const { filtros } = useFiltros();
  const [modo, setModo] = useState<Modo>("atual");
  const [item, setItem] = useState(0);
  const [W, setW] = useState(1920);
  const [escala, setEscala] = useState(0.5);
  const [progresso, setProgresso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const palco = useRef<HTMLDivElement>(null);

  const periodo = useMemo<Filtros>(() => ({ ...FILTROS_VAZIOS, anos: filtros.anos, meses: filtros.meses }), [filtros.anos, filtros.meses]);
  const doPeriodo = useMemo(() => aplicar(data.registros.filter((r) => r.categoria === "acidente"), periodo), [data, periodo]);

  // opções de cada modo: só o que tem eventos no período, da maior para a menor quantidade
  const alvos = useMemo<Alvo[]>(() => {
    const ordenar = (nomes: string[], valor: (r: (typeof doPeriodo)[number]) => string) =>
      nomes
        .map((n) => ({ n, q: doPeriodo.filter((r) => valor(r) === n).length }))
        .filter((x) => x.n && x.q > 0)
        .sort((a, b) => b.q - a.q || a.n.localeCompare(b.n));
    if (modo === "atual") return [{ nome: "painel-geral", rotulo: "Painel geral", filtros }];
    if (modo === "base")
      return ordenar([...new Set([...BASES, ...doPeriodo.map((r) => r.base)])], (r) => r.base).map((x) => ({ nome: `base-${limpo(x.n)}`, rotulo: `Base ${x.n}`, filtros: { ...periodo, bases: [x.n] } }));
    if (modo === "gerencia")
      return ordenar([...new Set([...GERENCIAS, ...doPeriodo.map((r) => r.processo)])], (r) => r.processo).map((x) => ({ nome: `gerencia-${limpo(x.n)}`, rotulo: `Gerência ${x.n}`, filtros: { ...periodo, gerencias: [x.n] } }));
    return ordenar([...listaCoordenadores(), SEM_COORDENADOR], coordenadorDe).map((x) => ({ nome: `coordenador-${limpo(x.n)}`, rotulo: `Coordenador ${x.n}`, filtros: { ...periodo, coordenadores: [x.n] } }));
  }, [modo, filtros, periodo, doPeriodo]);

  const atual = alvos[Math.min(item, alvos.length - 1)];

  // escala do preview: cabe na largura disponível do modal
  useLayoutEffect(() => {
    const el = palco.current;
    if (!el) return;
    const ajustar = () => setEscala(Math.min(1, el.clientWidth / W, el.clientHeight / Math.round((W * 9) / 16)));
    ajustar();
    const ro = new ResizeObserver(ajustar);
    ro.observe(el);
    return () => ro.disconnect();
  }, [W]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && !ocupado && onClose();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onClose, ocupado]);

  const capturar = useCallback(async (): Promise<Blob> => {
    const el = box.current;
    if (!el) throw new Error("Painel não encontrado");
    const largura = el.offsetWidth;
    const blob = await toBlob(el, { width: largura, height: el.offsetHeight, canvasWidth: 1920, canvasHeight: 1080, pixelRatio: 1, cacheBust: true });
    if (!blob) throw new Error("Não foi possível gerar a imagem");
    return blob;
  }, []);

  const baixarUma = async () => {
    if (!atual) return;
    setOcupado(true);
    setProgresso("Gerando imagem…");
    try {
      await esperar(300);
      baixar(await capturar(), `${atual.nome}-${limpo(periodoTexto(atual.filtros))}.png`);
      setProgresso("");
    } catch (e) {
      setProgresso((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  const baixarTodas = async () => {
    setOcupado(true);
    try {
      for (let i = 0; i < alvos.length; i++) {
        setItem(i);
        setProgresso(`Gerando ${i + 1} de ${alvos.length} — ${alvos[i].rotulo}`);
        await esperar(2400); // ajuste da largura + animação dos gráficos
        const blob = await capturar();
        baixar(blob, `${alvos[i].nome}-${limpo(periodoTexto(alvos[i].filtros))}.png`);
        await esperar(400); // dá tempo ao navegador de iniciar cada download
      }
      setProgresso(`${alvos.length} imagens baixadas.`);
    } catch (e) {
      setProgresso((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  const alturaSlide = Math.round((W * 9) / 16);

  return (
    <div className="foto-back" role="dialog" aria-modal="true" aria-label="Fotografia do painel" onMouseDown={(e) => e.target === e.currentTarget && !ocupado && onClose()}>
      <div className="foto">
        <div className="foto-top">
          <div>
            <h3>Fotografia do painel</h3>
            <small>Imagem 16:9 (1920 × 1080) pronta para slides do PowerPoint. Usa o tema e o período (ano/mês) selecionados.</small>
          </div>
          <button className="icon-btn" onClick={onClose} disabled={ocupado} aria-label="Fechar"><X size={18} /></button>
        </div>

        <div className="foto-ctrl">
          <div className="seg" role="tablist">
            {MODOS.map((m) => (
              <button key={m.id} className={modo === m.id ? "on" : ""} disabled={ocupado} onClick={() => { setModo(m.id); setItem(0); }}>{m.rotulo}</button>
            ))}
          </div>
          {modo !== "atual" && (
            <select className="select" value={Math.min(item, Math.max(alvos.length - 1, 0))} disabled={ocupado || !alvos.length} onChange={(e) => setItem(Number(e.target.value))} aria-label="Escolher recorte">
              {alvos.map((a, i) => <option key={a.nome} value={i}>{a.rotulo}</option>)}
            </select>
          )}
          <div className="grow" />
          <button className="btn" disabled={ocupado || !atual} onClick={baixarUma}><Download size={15} /> Baixar PNG</button>
          {modo !== "atual" && (
            <button className="btn primary" disabled={ocupado || !alvos.length} onClick={baixarTodas}><Package size={15} /> Baixar todas ({alvos.length}) PNG</button>
          )}
        </div>
        {progresso && <div className="foto-prog" role="status">{progresso}</div>}

        <div className="foto-palco" ref={palco}>
          {atual ? (
            <div className="foto-moldura" style={{ width: W * escala, height: alturaSlide * escala }}>
              <div style={{ width: W, height: alturaSlide, transform: `scale(${escala})`, transformOrigin: "top left" }}>
                <Slide alvo={atual} onLargura={setW} boxRef={box} />
              </div>
            </div>
          ) : (
            <div className="empty">Nenhum evento neste período para gerar a imagem.</div>
          )}
        </div>
      </div>
    </div>
  );
}
