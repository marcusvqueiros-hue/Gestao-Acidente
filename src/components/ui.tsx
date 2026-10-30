import { useEffect, useState, type ReactNode } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { X } from "lucide-react";
import { useTheme } from "../lib/theme";
import { ROTULO_FILTRO, useFiltros, type ChaveFiltro } from "../lib/filters";
import { MESES } from "../types";

export function Logo({ height = 28, tema }: { height?: number; tema?: "claro" | "escuro" }) {
  const { mode } = useTheme();
  const variante = tema ?? (mode === "dark" ? "escuro" : "claro");
  return (
    <img
      src={`/logo-cgb-${variante}.png`}
      alt="CGB"
      height={height}
      decoding="async"
      style={{ height, width: "auto", display: "block", imageRendering: "auto" }}
    />
  );
}

export function Card({ title, extra, className = "", children, onClick, active, dim }: { title?: string; extra?: ReactNode; className?: string; children: ReactNode; onClick?: () => void; active?: boolean; dim?: boolean }) {
  return (
    <section
      className={`card ${className} ${onClick ? "pick" : ""} ${active ? "active" : ""}`}
      style={dim ? { opacity: 0.45 } : undefined}
      onClick={onClick}
      {...(onClick ? { role: "button", tabIndex: 0, "aria-pressed": !!active, onKeyDown: (e: React.KeyboardEvent) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onClick()) } : {})}
    >
      {title && (
        <h3>
          {title}
          {extra && <small>{extra}</small>}
        </h3>
      )}
      {children}
    </section>
  );
}

export const Empty = () => <div className="empty">Sem dados para os filtros selecionados.</div>;

export function Badge({ lesao }: { lesao: string }) {
  const { c } = useTheme();
  const cor = c.lesao[lesao] ?? "#8b979b";
  return (
    <span className="badge" style={{ background: cor + "2b", color: cor }}>
      {lesao || "—"}
    </span>
  );
}

/** Tooltip no estilo do tema, usado em todos os gráficos. */
export function ChartTip({ active, payload, label, fmt }: { active?: boolean; payload?: any[]; label?: string | number; fmt?: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p.value != null && p.dataKey !== "total");
  return (
    <div className="tip">
      {label != null && label !== "" && <b>{label}</b>}
      {rows.map((p, i) => (
        <div key={i}>
          <i style={{ background: p.color ?? p.payload?.fill ?? p.fill }} />
          <span>{p.name}</span>
          <strong>{fmt ? fmt(Number(p.value)) : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

const RAD = Math.PI / 180;
const claro = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 150;
};

interface Item {
  name: string;
  value: number;
}
interface Selecionavel {
  selected?: string[];
  onPick?: (name: string) => void;
}

export function Donut({ data, label = "eventos", selected = [], onPick, animar = true }: { data: Item[]; label?: string; animar?: boolean } & Selecionavel) {
  const { c } = useTheme();
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <Empty />;
  const cor = (i: number) => c.paleta[i % c.paleta.length];
  const filtrado = selected.length > 0;
  const centro = filtrado ? data.filter((d) => selected.includes(d.name)).reduce((s, d) => s + d.value, 0) : total;
  const esmaece = (n: string) => (filtrado && !selected.includes(n) ? 0.28 : 1);

  const rotulo = (p: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent, value, index, name } = p;
    const cos = Math.cos(-midAngle * RAD), sin = Math.sin(-midAngle * RAD);
    const rm = (innerRadius + outerRadius) / 2;
    const pt = (r: number) => [cx + r * cos, cy + r * sin];
    const [ix, iy] = pt(rm), [x1, y1] = pt(outerRadius + 2), [x2, y2] = pt(outerRadius + 12), [tx, ty] = pt(outerRadius + 16);
    return (
      <g opacity={esmaece(name)} style={{ pointerEvents: "none" }}>
        {percent >= 0.045 && (
          <text x={ix} y={iy} textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={700} fill={claro(cor(index)) ? "#1d1a1f" : "#fff"}>
            {value}
          </text>
        )}
        <polyline points={`${x1},${y1} ${x2},${y2}`} stroke={c.text} strokeOpacity={0.5} fill="none" />
        <text x={tx} y={ty} textAnchor={cos >= 0 ? "start" : "end"} dominantBaseline="central" fontSize={12} fontWeight={600} fill={c.text}>
          {Math.round(percent * 100)}%
        </text>
      </g>
    );
  };

  return (
    <>
      <div className="donut" style={{ height: 240 }}>
        <ResponsiveContainer>
          <PieChart margin={{ top: 14, right: 14, bottom: 14, left: 14 }}>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              cornerRadius={5}
              stroke="none"
              label={rotulo}
              isAnimationActive={animar}
              labelLine={false}
              onClick={(d: any) => onPick?.(d.name)}
              style={{ cursor: onPick ? "pointer" : "default" }}
            >
              {data.map((d, i) => (
                <Cell key={d.name} fill={cor(i)} fillOpacity={esmaece(d.name)} />
              ))}
            </Pie>
            <Tooltip content={<ChartTip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="center">
          <b>{centro}</b>
          <small>{label}</small>
        </div>
      </div>
      <div className="legend">
        {data.map((d, i) => (
          <button
            key={d.name}
            className={`leg-item ${selected.includes(d.name) ? "on" : ""}`}
            style={{ opacity: esmaece(d.name) }}
            onClick={() => onPick?.(d.name)}
            disabled={!onPick}
          >
            <i style={{ background: cor(i) }} />
            {d.name}
          </button>
        ))}
      </div>
    </>
  );
}

const toque = () => typeof window !== "undefined" && !!window.matchMedia?.("(hover: none)").matches;

/** Trava a rolagem da página enquanto um modal está aberto. */
export function useTravaRolagem() {
  useEffect(() => {
    document.body.classList.add("lock");
    return () => document.body.classList.remove("lock");
  }, []);
}

export function Rank({
  data,
  limit = Infinity,
  selected = [],
  onPick,
  detail,
  detailTitle = "Tipologia dos acidentes",
}: { data: Item[]; limit?: number; detail?: (name: string) => Item[]; detailTitle?: string } & Selecionavel) {
  const [hover, setHover] = useState<{ name: string; x: number; y: number } | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const celular = toque();
  if (!data.length) return <Empty />;
  const max = data[0].value;
  const filtrado = selected.length > 0;
  const det = hover && detail ? detail(hover.name) : [];
  const detMax = det[0]?.value ?? 1;
  const linhas = det.slice(0, 6);
  return (
    <>
      <div className="rank">
        {data.slice(0, limit).map((d) => (
          <div key={d.name} className="rank-item">
            <div
              className={`rank-row ${onPick ? "pick" : ""} ${selected.includes(d.name) ? "on" : ""} ${detail && celular ? "com-info" : ""}`}
              title={detail ? undefined : d.name}
              style={{ opacity: filtrado && !selected.includes(d.name) ? 0.35 : 1 }}
              onClick={() => onPick?.(d.name)}
              onMouseMove={detail && !celular ? (e) => setHover({ name: d.name, x: e.clientX, y: e.clientY }) : undefined}
              onMouseLeave={detail && !celular ? () => setHover(null) : undefined}
            >
              <span>{d.name}</span>
              <div className="bar">
                <i style={{ width: `${(d.value / max) * 100}%` }} />
              </div>
              <b>{d.value}</b>
              {detail && celular && (
                <button
                  className="info-btn"
                  aria-expanded={aberto === d.name}
                  aria-label={`Ver tipologia de ${d.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setAberto(aberto === d.name ? null : d.name);
                  }}
                >
                  {aberto === d.name ? "−" : "+"}
                </button>
              )}
            </div>
            {detail && celular && aberto === d.name && (
              <div className="inline-detail">
                {(() => {
                  const itens = detail(d.name);
                  const topo = itens[0]?.value || 1;
                  return itens.slice(0, 6).map((x) => (
                    <div className="pop-row" key={x.name}>
                      <span title={x.name}>{x.name}</span>
                      <div className="bar"><i style={{ width: `${(x.value / topo) * 100}%` }} /></div>
                      <strong>{x.value}</strong>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        ))}
      </div>
      {hover && linhas.length > 0 && (
        <div
          className="pop"
          style={{
            left: Math.max(8, Math.min(hover.x + 16, window.innerWidth - 330)),
            top: Math.max(8, Math.min(hover.y + 16, window.innerHeight - 90 - linhas.length * 26)),
          }}
        >
          <b>{hover.name}</b>
          <small>
            {detailTitle} · {det.reduce((s, x) => s + x.value, 0)} evento(s)
          </small>
          {linhas.map((x) => (
            <div className="pop-row" key={x.name}>
              <span title={x.name}>{x.name}</span>
              <div className="bar">
                <i style={{ width: `${(x.value / detMax) * 100}%` }} />
              </div>
              <strong>{x.value}</strong>
            </div>
          ))}
          {det.length > 6 && <small>+ {det.length - 6} outras tipologias</small>}
        </div>
      )}
    </>
  );
}

/** Faixa com as seleções ativas (o ano fica de fora; ele já aparece na lateral). */
export function FiltroTags() {
  const { filtros, toggle, limparSelecoes } = useFiltros();
  const tags = (Object.keys(ROTULO_FILTRO) as ChaveFiltro[])
    .filter((k) => k !== "anos")
    .flatMap((k) => (filtros[k] as (string | number)[]).map((v) => ({ k, v })));
  if (!tags.length) return null;
  return (
    <div className="tags" role="list" aria-label="Filtros ativos">
      <small>Filtrando por</small>
      {tags.map(({ k, v }) => (
        <button key={k + v} className="tag" onClick={() => toggle(k, v)} title="Remover filtro">
          <span>{ROTULO_FILTRO[k]}:</span> {k === "meses" ? MESES[Number(v) - 1] : String(v)} <X size={12} />
        </button>
      ))}
      <button className="tag clear" onClick={limparSelecoes}>
        Limpar seleções
      </button>
    </div>
  );
}

export function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [msg, onDone]);
  return <div className="toast" role="status">{msg}</div>;
}

export function Chips<T extends string | number>({ options, selected, onToggle, label }: { options: T[]; selected: T[]; onToggle: (v: T) => void; label?: (v: T) => string }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o} className={`chip ${selected.includes(o) ? "on" : ""}`} onClick={() => onToggle(o)} aria-pressed={selected.includes(o)}>
          {label ? label(o) : o}
        </button>
      ))}
    </div>
  );
}
