import { useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertOctagon, AlertTriangle, CheckCircle2, Lightbulb, Target } from "lucide-react";
import { useData } from "../lib/store";
import { useTheme } from "../lib/theme";
import { Card, Chips, Empty } from "../components/ui";
import { MESES } from "../types";
import { COR_NIVEL, RECOMENDACAO, ROTULO_NIVEL, analisar, type Insight, type Nivel } from "../lib/insights";
import { Grad } from "./Dashboard";

const ICONE: Record<Nivel, typeof Target> = { critico: AlertOctagon, atencao: AlertTriangle, oportunidade: Lightbulb, positivo: CheckCircle2 };
const NIVEIS: Nivel[] = ["critico", "atencao", "oportunidade", "positivo"];

function CartaoInsight({ i, aberto, onToggle }: { i: Insight; aberto: boolean; onToggle: () => void }) {
  const Icone = ICONE[i.nivel];
  const cor = COR_NIVEL[i.nivel];
  return (
    <article className="insight" style={{ ["--c" as string]: cor }}>
      <button type="button" className="insight-cab" onClick={onToggle} aria-expanded={aberto}>
        <span className="insight-ico"><Icone size={18} /></span>
        <span className="insight-tit">
          <small>{i.eixo} · {ROTULO_NIVEL[i.nivel]}</small>
          <b>{i.titulo}</b>
        </span>
        <span className="insight-seta" aria-hidden>{aberto ? "−" : "+"}</span>
      </button>
      <p className="insight-leitura">{i.leitura}</p>
      {aberto && (
        <div className="insight-corpo">
          {i.evidencias.length > 0 && (
            <ul className="insight-evid">
              {i.evidencias.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}
          <div className="insight-acao"><Target size={15} /><div><small>O que fazer</small><p>{i.acao}</p></div></div>
        </div>
      )}
    </article>
  );
}

export default function Insights() {
  const { data } = useData();
  const { c } = useTheme();
  const anos = useMemo(() => [...new Set([...data.registros.filter((r) => r.categoria === "acidente").map((r) => Number(r.data.slice(0, 4))), new Date().getFullYear()])].sort(), [data.registros]);
  const [ano, setAno] = useState(() => new Date().getFullYear());
  const [nivel, setNivel] = useState<Nivel | "todos">("todos");
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const a = useMemo(() => analisar(data, ano), [data, ano]);
  const visiveis = a.insights.filter((i) => nivel === "todos" || i.nivel === nivel);
  const cont = (n: Nivel) => a.insights.filter((i) => i.nivel === n).length;
  const alterna = (id: string) => setAbertos((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const axis = { fontSize: 12, fill: c.text };
  const variacao = a.totalAnt ? Math.round(((a.total - a.totalAnt) / a.totalAnt) * 100) : null;
  const maxRisco = Math.max(1, ...a.prioridades.map((p) => p.risco));

  return (
    <>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <Chips options={anos} selected={[ano]} onToggle={(v) => setAno(v)} />
        <div className="grow" />
        <button className="btn" onClick={() => setAbertos(abertos.size ? new Set() : new Set(visiveis.map((i) => i.id)))}>{abertos.size ? "Recolher todos" : "Expandir todos"}</button>
      </div>

      <section className="insight-hero">
        <div className="insight-hero-ico"><Lightbulb size={26} /></div>
        <div>
          <small>Resumo executivo · {ano}</small>
          <h2>Onde agir para reduzir sinistros por gravidade e tipologia</h2>
          <ul>{a.resumo.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      </section>

      <div className="ndgs-kpis">
        {[
          { r: "Sinistros no ano", v: a.total, cor: "var(--line)", s: variacao == null ? "sem base de comparação" : `${variacao > 0 ? "+" : ""}${variacao}% vs ${ano - 1} (mesmo período)` },
          { r: "Com afastamento ou fatal", v: a.graves, cor: a.graves ? "#e0566f" : "#22b45f", s: a.gravesAnt ? `${a.gravesAnt} no mesmo período de ${ano - 1}` : "foco da redução de gravidade" },
          { r: "Fatais", v: a.fatais, cor: a.fatais ? "#e0566f" : "#22b45f", s: a.fatais ? "exigem ação imediata" : "nenhum no período" },
          { r: "Maior frente de risco", v: a.prioridades[0] ? `${a.prioridades[0].parte}%` : "—", cor: "#f2b01e", s: a.prioridades[0]?.familia ?? "sem dados" },
          { r: "Pontos críticos", v: cont("critico"), cor: cont("critico") ? "#e0566f" : "#22b45f", s: `${cont("atencao")} de atenção · ${cont("oportunidade")} oportunidades` },
        ].map((k) => (
          <div key={k.r} className="ndgs-kpi" style={{ ["--c" as string]: k.cor }}>
            <small>{k.r}</small>
            <b>{k.v}</b>
            <small>{k.s}</small>
          </div>
        ))}
      </div>

      <div className="grid">
        <Card title="Onde está o risco: tipologia ponderada pela gravidade" extra="fatal e afastamento pesam mais que contagem" className="s7">
          {a.prioridades.length ? (
            <div className="prior">
              {a.prioridades.map((p, i) => (
                <div key={p.familia} className="prior-linha">
                  <span className="pos">{i + 1}º</span>
                  <div className="meio">
                    <div className="topo"><b>{p.familia}</b><small>{p.eventos} evento(s){p.graves ? ` · ${p.graves} grave(s)` : ""}</small></div>
                    <div className="barra"><i style={{ width: `${(p.risco / maxRisco) * 100}%` }} /></div>
                  </div>
                  <span className="pct">{p.parte}%</span>
                </div>
              ))}
              <small className="prior-nota">Pontuação: fatal 100 · com afastamento 25 + dias perdidos · sem afastamento 3 · incidente 1.</small>
            </div>
          ) : (
            <Empty />
          )}
        </Card>

        <Card title="Evolução mensal: eventos e risco ponderado" className="s5">
          {a.total ? (
            <div style={{ height: 270 }}>
              <ResponsiveContainer>
                <ComposedChart data={a.porMesRisco.filter((m) => m.mes <= Math.max(a.mesAtual, 1)).map((m) => ({ ...m, nome: MESES[m.mes - 1] }))} margin={{ top: 16, right: 8, left: -18, bottom: 0 }}>
                  <defs><Grad id="ins-b" color={c.bar} /></defs>
                  <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="3 5" />
                  <XAxis dataKey="nome" tick={axis} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="e" tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis yAxisId="r" orientation="right" hide />
                  <Tooltip cursor={{ fill: c.cursor, radius: 8 }} wrapperStyle={{ zIndex: 20 }} contentStyle={{ borderRadius: 12 }} />
                  <Bar yAxisId="e" dataKey="eventos" name="Eventos" fill="url(#ins-b)" radius={[7, 7, 0, 0]} maxBarSize={26} isAnimationActive={false} />
                  <Line yAxisId="r" type="monotone" dataKey="risco" name="Risco ponderado" stroke="#f2b01e" strokeWidth={3} dot={{ r: 3 }} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty />
          )}
          <div className="legend"><span className="leg-item" style={{ cursor: "default" }}><i style={{ background: c.bar }} />Eventos</span><span className="leg-item" style={{ cursor: "default" }}><i style={{ background: "#f2b01e" }} />Risco ponderado</span></div>
        </Card>
      </div>

      <div className="seg" role="group" aria-label="Filtrar insights por nível" style={{ margin: "22px 0 14px", flexWrap: "wrap" }}>
        <button className={nivel === "todos" ? "on" : ""} onClick={() => setNivel("todos")}>Todos ({a.insights.length})</button>
        {NIVEIS.map((n) => <button key={n} className={nivel === n ? "on" : ""} onClick={() => setNivel(n)} disabled={!cont(n)}>{ROTULO_NIVEL[n]} ({cont(n)})</button>)}
      </div>

      {visiveis.length ? (
        <div className="insights-lista">
          {visiveis.map((i) => <CartaoInsight key={i.id} i={i} aberto={abertos.has(i.id)} onToggle={() => alterna(i.id)} />)}
        </div>
      ) : (
        <Card><Empty /></Card>
      )}

      <Card title="Recomendações por tipologia" extra="boas práticas para reduzir cada família" className="s12">
        <div className="reco-grid">
          {Object.entries(RECOMENDACAO).filter(([k]) => a.prioridades.some((p) => p.familia === k)).map(([k, v]) => (
            <div key={k} className="reco">
              <b>{k}</b>
              <p>{v}</p>
            </div>
          ))}
        </div>
        <p className="hint-inline" style={{ marginTop: 12 }}>Os insights são gerados automaticamente a partir dos sinistros, das taxas e do plano de ação. Servem de apoio à decisão e não substituem a análise de causa raiz de cada evento.</p>
      </Card>
    </>
  );
}
