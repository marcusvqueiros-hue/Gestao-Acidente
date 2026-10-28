import { useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Legend, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useData } from "../lib/store";
import { aplicar, anoDe, mesDe, useFiltros } from "../lib/filters";
import { contar, fmtNum, resumo } from "../lib/stats";
import { diaDaSemana } from "../lib/parse";
import { MESES } from "../types";
import { useTheme } from "../lib/theme";
import { Card, ChartTip, Chips, Empty } from "../components/ui";
import { Grad } from "./Dashboard";

const nonZero = (v: unknown) => (Number(v) ? String(v) : "");

const METRICAS = [
  { id: "total", label: "Total" },
  { id: "sem", label: "Sem afastamento" },
  { id: "com", label: "Com afastamento" },
  { id: "incidente", label: "Incidentes" },
  { id: "fatal", label: "Fatais" },
] as const;
type Metrica = (typeof METRICAS)[number]["id"];

const DIMENSOES = {
  gerencia: { label: "Gerência", key: (r: { processo: string }) => r.processo },
  base: { label: "Base", key: (r: { base: string }) => r.base },
  tipo: { label: "Tipologia", key: (r: { tipo: string }) => r.tipo },
  dia: { label: "Dia da semana", key: (r: { data: string }) => diaDaSemana(r.data) },
} as const;
type Dim = keyof typeof DIMENSOES;

export default function Compare() {
  const { data } = useData();
  const { filtros } = useFiltros();
  const { c } = useTheme();
  const axis = { fontSize: 12, fill: c.text };
  const corAno = (i: number, n: number) => (n <= c.anos.length ? c.anos.slice(-n)[i] : c.anos[i % c.anos.length]);
  const anosAll = useMemo(() => [...new Set(data.registros.filter((r) => r.categoria === "acidente").map(anoDe))].sort(), [data]);
  const [anos, setAnos] = useState<number[]>(anosAll);
  const [metrica, setMetrica] = useState<Metrica>("total");
  const [taxa, setTaxa] = useState<"tfca" | "tf" | "tg">("tfca");
  const [dim, setDim] = useState<Dim>("gerencia");
  const [ytd, setYtd] = useState(true);

  const hoje = new Date();
  const maxAno = anosAll[anosAll.length - 1];
  const limite = ytd && hoje.getFullYear() === maxAno ? hoje.getMonth() + 1 : 12;
  const sel = anosAll.filter((a) => anos.includes(a));

  const regs = useMemo(
    () => aplicar(data.registros.filter((r) => r.categoria === "acidente"), { ...filtros, anos: sel }, {}).filter((r) => mesDe(r) <= limite),
    [data, filtros, sel, limite],
  );

  const mensal = useMemo(
    () =>
      MESES.slice(0, limite).map((nome, i) => {
        const o: Record<string, number | string> = { nome };
        for (const a of sel) o[a] = resumo(regs.filter((r) => anoDe(r) === a && mesDe(r) === i + 1))[metrica];
        return o;
      }),
    [regs, sel, metrica, limite],
  );

  const porAno = sel.map((a) => ({ ano: a, ...resumo(regs.filter((r) => anoDe(r) === a)) }));

  const taxasMes = useMemo(
    () =>
      MESES.slice(0, limite).map((nome, i) => {
        const o: Record<string, number | string> = { nome };
        for (const a of sel) o[a] = data.taxas.find((t) => t.ano === a && t.mes === i + 1)?.[taxa] ?? 0;
        return o;
      }),
    [data.taxas, sel, taxa, limite],
  );

  const dimData = useMemo(() => {
    const names = contar(regs, DIMENSOES[dim].key as never).map((d) => d.name);
    const ordered = names;
    return ordered.map((name) => {
      const o: Record<string, number | string> = { nome: name };
      for (const a of sel) o[a] = regs.filter((r) => anoDe(r) === a && (DIMENSOES[dim].key as (r: never) => string)(r as never) === name).length;
      return o;
    });
  }, [regs, dim, sel]);

  const delta = (i: number, k: Metrica) => {
    if (i === 0) return null;
    const a = porAno[i - 1][k], b = porAno[i][k];
    if (a === 0 && b === 0) return null;
    if (a === 0) return { txt: "novo", good: false };
    const p = Math.round(((b - a) / a) * 100);
    return { txt: `${p > 0 ? "+" : ""}${p}%`, good: p <= 0 };
  };


  return (
    <>
      <div className="note">
        Compara os anos escolhidos; os filtros de mês, base e gerência da lateral continuam valendo. O filtro de ano da lateral é ignorado aqui.
      </div>
      <div className="topbar" style={{ marginBottom: 14, gap: 18 }}>
        <Chips options={anosAll} selected={anos} onToggle={(a) => setAnos((c) => (c.includes(a) ? c.filter((x) => x !== a) : [...c, a]))} />
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 500 }}>
          <input type="checkbox" checked={ytd} onChange={(e) => setYtd(e.target.checked)} />
          Mesmo período (até {MESES[limite - 1]})
        </label>
      </div>

      {sel.length === 0 ? (
        <Card><Empty /></Card>
      ) : (
        <div className="grid">
          <Card title="Resumo por ano" className="s12">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ano</th>
                    {METRICAS.map((m) => <th key={m.id} className="num">{m.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {porAno.map((r, i) => (
                    <tr key={r.ano}>
                      <td><b>{r.ano}</b></td>
                      {METRICAS.map((m) => {
                        const d = delta(i, m.id);
                        return (
                          <td key={m.id} className="num">
                            <b>{r[m.id]}</b>{" "}
                            {d && <span className={`delta ${d.good ? "good" : "bad"}`}>{d.txt}</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 10 }}>Variação em relação ao ano anterior da lista; queda é favorável.</p>
          </Card>

          <Card
            title="Eventos por mês"
            className="s12"
            extra={
              <span className="seg" style={{ padding: 2 }}>
                {METRICAS.map((m) => (
                  <button key={m.id} className={metrica === m.id ? "on" : ""} onClick={() => setMetrica(m.id)} style={{ padding: "3px 10px", fontSize: 12 }}>{m.label}</button>
                ))}
              </span>
            }
          >
            <div style={{ height: 300 }}>
              <ResponsiveContainer>
                <ComposedChart data={mensal} margin={{ top: 22, right: 6, left: 6, bottom: 0 }}>
                  <defs>{sel.map((a, i) => <Grad key={a} id={`m${a}`} color={corAno(i, sel.length)} />)}</defs>
                  <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="3 5" />
                  <XAxis dataKey="nome" tick={axis} axisLine={false} tickLine={false} />
                  <YAxis hide domain={[0, "dataMax + 1"]} />
                  <Tooltip cursor={{ fill: c.cursor, radius: 8 }} content={<ChartTip />} />
                  <Legend verticalAlign="bottom" align="center" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: c.text, width: "100%", textAlign: "center", paddingTop: 8 }} />
                  {sel.map((a, i) => (
                    <Bar key={a} dataKey={a} name={String(a)} fill={`url(#m${a})`} maxBarSize={30} radius={[7, 7, 0, 0]}>
                      <LabelList dataKey={a} position="top" formatter={nonZero} fill={c.text} fontSize={11} fontWeight={600} />
                    </Bar>
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card
            title="Taxas por mês"
            className="s6"
            extra={
              <span className="seg" style={{ padding: 2 }}>
                {([["tfca", "TFCA"], ["tf", "TF"], ["tg", "TG"]] as const).map(([id, l]) => (
                  <button key={id} className={taxa === id ? "on" : ""} onClick={() => setTaxa(id)} style={{ padding: "3px 10px", fontSize: 12 }}>{l}</button>
                ))}
              </span>
            }
          >
            <div style={{ height: 280 }}>
              <ResponsiveContainer>
                <LineChart data={taxasMes} margin={{ top: 26, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="3 5" />
                  <XAxis dataKey="nome" tick={axis} axisLine={false} tickLine={false} />
                  <YAxis hide scale={taxa === "tg" ? "sqrt" : "auto"} domain={[0, "auto"]} />
                  <Tooltip cursor={{ stroke: c.grid, strokeWidth: 2 }} content={<ChartTip fmt={(v) => fmtNum(v)} />} />
                  <Legend verticalAlign="bottom" align="center" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: c.text, width: "100%", textAlign: "center", paddingTop: 8 }} />
                  {sel.map((a, i) => (
                    <Line key={a} type="monotone" dataKey={a} name={String(a)} stroke={corAno(i, sel.length)} strokeWidth={3} strokeLinecap="round" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} >
                      <LabelList dataKey={a} position="top" offset={8} formatter={(v: unknown) => (Number(v) ? fmtNum(Number(v), taxa === "tg" ? 0 : 1) : "")} fill={corAno(i, sel.length)} fontSize={11} fontWeight={700} />
                    </Line>
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            {taxa === "tg" && <p style={{ color: "var(--muted)", fontSize: 12 }}>Eixo em escala de raiz, por causa dos meses com acidente fatal.</p>}
          </Card>

          <Card
            title="Distribuição"
            className="s6"
            extra={
              <select className="select" value={dim} onChange={(e) => setDim(e.target.value as Dim)} style={{ padding: "3px 8px", fontSize: 12, width: "auto" }}>
                {Object.entries(DIMENSOES).map(([id, d]) => <option key={id} value={id}>{d.label}</option>)}
              </select>
            }
          >
            {dimData.length ? (
              <div style={{ height: 280 }}>
                <ResponsiveContainer>
                  <ComposedChart data={dimData} margin={{ top: 22, right: 6, left: 6, bottom: 0 }}>
                  <defs>{sel.map((a, i) => <Grad key={a} id={`d${a}`} color={corAno(i, sel.length)} />)}</defs>
                  <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="3 5" />
                  <XAxis dataKey="nome" tick={axis} axisLine={false} tickLine={false} interval={0} tickFormatter={(v: string) => (v.length > 9 ? v.slice(0, 8) + "…" : v)} />
                  <YAxis hide domain={[0, "dataMax + 1"]} />
                  <Tooltip cursor={{ fill: c.cursor, radius: 8 }} content={<ChartTip />} />
                  <Legend verticalAlign="bottom" align="center" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: c.text, width: "100%", textAlign: "center", paddingTop: 8 }} />
                  {sel.map((a, i) => (
                    <Bar key={a} dataKey={a} name={String(a)} fill={`url(#d${a})`} maxBarSize={30} radius={[7, 7, 0, 0]}>
                      <LabelList dataKey={a} position="top" formatter={nonZero} fill={c.text} fontSize={11} fontWeight={600} />
                    </Bar>
                  ))}
                </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty />
            )}
          </Card>
        </div>
      )}
    </>
  );
}
