import { useMemo } from "react";
import { Bar, Cell, CartesianGrid, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Moon, ShieldCheck, Sun, Sunrise } from "lucide-react";
import { useData } from "../lib/store";
import { aplicar, useFiltros, type ChaveFiltro } from "../lib/filters";
import { contar, diasSemAfastamento, porMes, resumo } from "../lib/stats";
import { DIAS, LESOES, MESES } from "../types";
import { diaDaSemana } from "../lib/parse";
import { useTheme } from "../lib/theme";
import { Card, ChartTip, Donut, Empty, Rank } from "../components/ui";

const nonZero = (v: unknown) => (Number(v) ? String(v) : "");
const ESMAECIDO = 0.25;

export function Grad({ id, color }: { id: string; color: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={1} />
      <stop offset="100%" stopColor={color} stopOpacity={0.72} />
    </linearGradient>
  );
}

export default function Dashboard({ compacto = false }: { compacto?: boolean }) {
  const { data } = useData();
  const { filtros, toggle } = useFiltros();
  const { c, mode } = useTheme();
  const axis = { fontSize: 12, fill: c.text };
  const alt = compacto ? 220 : 290;
  const ex = (t: string) => (compacto ? undefined : t);
  const topo = compacto ? 7 : undefined;
  const col = (n: number) => (compacto ? "s3" : `s${n}`);

  const acidentes = useMemo(() => data.registros.filter((r) => r.categoria === "acidente"), [data]);
  // cada gráfico ignora a própria seleção, para continuar mostrando todas as opções (as não selecionadas ficam esmaecidas)
  const R = (...ign: ChaveFiltro[]) => aplicar(acidentes, filtros, { ignorar: ign });

  const regs = useMemo(() => R(), [acidentes, filtros]);
  // os cartões ignoram a seleção de lesão, para continuarem mostrando todas as contagens
  const k = useMemo(() => resumo(R("lesoes")), [acidentes, filtros]);
  const selLesao = (l: string) => filtros.lesoes.includes(l);
  const dimLesao = (l: string[]) => filtros.lesoes.length > 0 && !l.some(selLesao);
  const pickLesao = (ls: string[]) => () => {
    const todos = ls.every(selLesao);
    ls.forEach((l) => (todos ? selLesao(l) : !selLesao(l)) && toggle("lesoes", l));
  };
  const limparLesao = () => filtros.lesoes.forEach((l) => toggle("lesoes", l));
  // dias desde o último afastamento: respeita base, gerência, equipe etc., mas não o período nem a lesão selecionados
  const sem = useMemo(() => diasSemAfastamento(R("anos", "meses", "lesoes", "dias", "turnos")), [acidentes, filtros]);
  const escopo = [...filtros.bases, ...filtros.gerencias].join(", ");

  const mensal = useMemo(() => porMes(R("meses", "lesoes")).map((m) => ({ ...m, nome: MESES[m.mes - 1] }) as Record<string, number | string> & { mes: number; total: number; nome: string }), [acidentes, filtros]);
  const semana = useMemo(() => {
    const cnt = contar(R("dias"), (r) => diaDaSemana(r.data));
    return DIAS.map((d) => ({ nome: d.slice(0, 3), dia: d, value: cnt.find((x) => x.name === d)?.value ?? 0 })).sort((a, b) => b.value - a.value);
  }, [acidentes, filtros]);
  const turnoRegs = useMemo(() => R("turnos"), [acidentes, filtros]);
  const turno = (t: string) => turnoRegs.filter((r) => r.turno === t).length;

  const processo = useMemo(() => contar(R("gerencias"), (r) => r.processo), [acidentes, filtros]);
  const tipo = useMemo(() => contar(R("tipos"), (r) => r.tipo), [acidentes, filtros]);
  const terceiros = useMemo(() => contar(R("envolvidos"), (r) => r.envolvidos), [acidentes, filtros]);
  const baseRegs = useMemo(() => R("bases"), [acidentes, filtros]);
  const base = useMemo(() => contar(baseRegs, (r) => r.base), [baseRegs]);
  const equipeRegs = useMemo(() => R("equipes"), [acidentes, filtros]);
  const equipes = useMemo(() => contar(equipeRegs, (r) => r.prefixo), [equipeRegs]);
  const colabRegs = useMemo(() => R("colaboradores"), [acidentes, filtros]);
  const colaboradores = useMemo(() => contar(colabRegs, (r) => r.colaborador), [colabRegs]);
  const resumoDef = useMemo(() => contar(R("definicoes"), (r) => r.definicao.toUpperCase()), [acidentes, filtros]);
  const carac = useMemo(() => contar(R("caracteristicas"), (r) => r.caracteristica), [acidentes, filtros]);

  const tipologiaDe = (lista: typeof regs, campo: "base" | "prefixo" | "colaborador") => (nome: string) =>
    contar(lista.filter((r) => r[campo] === nome), (r) => r.caracteristica || r.tipo);

  const mesTick = (p: any) => {
    const m = MESES.indexOf(p.payload.value) + 1;
    const on = filtros.meses.includes(m);
    return (
      <text x={p.x} y={p.y + 12} textAnchor="middle" fontSize={12} fontWeight={on ? 700 : 400} fill={on ? c.bar : c.text} style={{ cursor: "pointer" }} onClick={() => toggle("meses", m)}>
        {p.payload.value}
      </text>
    );
  };

  const turnos = [
    { t: "MANHÃ", icon: <Sunrise size={24} /> },
    { t: "TARDE", icon: <Sun size={24} /> },
    { t: "NOITE", icon: <Moon size={24} /> },
  ];

  return (
    <div className="grid">
      <Card className="s2 kpi" onClick={limparLesao}>
        <span>Total de eventos</span>
        <b>{k.total}</b>
        <small>{filtros.lesoes.length ? "clique para ver todos" : "no período filtrado"}</small>
      </Card>
      <Card className="s2 kpi" onClick={pickLesao(["SEM AFASTAMENTO"])} active={selLesao("SEM AFASTAMENTO")} dim={dimLesao(["SEM AFASTAMENTO"])}>
        <span><i className="dot" style={{ background: c.lesao["SEM AFASTAMENTO"] }} />Sem afastamento</span>
        <b>{k.sem}</b>
      </Card>
      <Card className="s2 kpi" onClick={pickLesao(["COM AFASTAMENTO"])} active={selLesao("COM AFASTAMENTO")} dim={dimLesao(["COM AFASTAMENTO"])}>
        <span><i className="dot" style={{ background: c.lesao["COM AFASTAMENTO"] }} />Com afastamento</span>
        <b>{k.com}</b>
      </Card>
      <Card className="s2 kpi" onClick={pickLesao(["INCIDENTE"])} active={selLesao("INCIDENTE")} dim={dimLesao(["INCIDENTE"])}>
        <span><i className="dot" style={{ background: c.lesao["INCIDENTE"] }} />Incidentes</span>
        <b>{k.incidente}</b>
      </Card>
      <Card className="s2 kpi" onClick={pickLesao(["FATAL"])} active={selLesao("FATAL")} dim={dimLesao(["FATAL"])}>
        <span><i className="dot" style={{ background: c.lesao["FATAL"] }} />Fatais</span>
        <b>{k.fatal}</b>
      </Card>
      <Card className="s2 kpi hero" onClick={pickLesao(["COM AFASTAMENTO", "FATAL"])} active={selLesao("COM AFASTAMENTO") && selLesao("FATAL")} dim={dimLesao(["COM AFASTAMENTO", "FATAL"])}>
        <span><ShieldCheck size={14} />Dias sem afastamento</span>
        <b>{sem ? sem.dias : "—"}</b>
        <small>{sem ? `desde ${sem.desde.split("-").reverse().join("/")}${escopo ? " · " + escopo : ""} · clique para ver os casos` : `nenhum afastamento registrado${escopo ? " em " + escopo : ""}`}</small>
      </Card>

      <Card title="Eventos por turno" extra={ex("clique para filtrar · somente com turno informado")} className={compacto ? "s3" : "s12"}>
        <div className="turnos">
          {turnos.map(({ t, icon }) => {
            const on = filtros.turnos.includes(t);
            const dim = filtros.turnos.length > 0 && !on;
            return (
              <button key={t} className={`turno ${on ? "on" : ""}`} style={{ opacity: dim ? 0.4 : 1 }} onClick={() => toggle("turnos", t)}>
                {icon}
                <div>
                  <b>{turno(t)}</b>
                  <small>{t[0] + t.slice(1).toLowerCase()}</small>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card title="Histórico de eventos acidentais" extra={ex("clique em uma barra ou mês")} className={compacto ? "s6" : "s8"}>
        {mensal.some((m) => m.total) ? (
          <>
            <div style={{ height: alt }}>
              <ResponsiveContainer>
                <ComposedChart data={mensal} margin={{ top: 22, right: 6, left: 6, bottom: 0 }}>
                  <defs>{LESOES.map((l) => <Grad key={l} id={`h-${l.replace(/ /g, "")}`} color={c.lesao[l]} />)}</defs>
                  <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="3 5" />
                  <XAxis dataKey="nome" tick={mesTick} axisLine={false} tickLine={false} />
                  <YAxis hide domain={[0, "dataMax + 1"]} />
                  <Tooltip cursor={{ fill: c.cursor, radius: 8 }} content={<ChartTip />} />
                  {LESOES.map((l) => (
                    <Bar
                      key={l}
                      dataKey={l}
                      name={l}
                      stackId="a"
                      fill={`url(#h-${l.replace(/ /g, "")})`}
                      maxBarSize={44}
                      radius={l === "SEM AFASTAMENTO" ? [8, 8, 0, 0] : 0}
                      style={{ cursor: "pointer" }}
                      onClick={() => toggle("lesoes", l)}
                    >
                      {mensal.map((m) => {
                        const dim = (filtros.meses.length > 0 && !filtros.meses.includes(m.mes)) || (filtros.lesoes.length > 0 && !filtros.lesoes.includes(l));
                        return <Cell key={m.mes} fill={`url(#h-${l.replace(/ /g, "")})`} fillOpacity={dim ? ESMAECIDO : 1} />;
                      })}
                      <LabelList dataKey={l} position="center" formatter={nonZero} fill={l === "FATAL" && mode === "dark" ? "#17141a" : c.onBar} fontSize={11} fontWeight={700} />
                    </Bar>
                  ))}
                  <Line dataKey="total" name="Total" stroke="none" dot={false} activeDot={false} legendType="none" isAnimationActive={false}>
                    <LabelList dataKey="total" position="top" formatter={nonZero} fill={c.text} fontSize={12} fontWeight={700} />
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="legend">
              {LESOES.map((l) => (
                <button key={l} className={`leg-item ${filtros.lesoes.includes(l) ? "on" : ""}`} style={{ opacity: filtros.lesoes.length && !filtros.lesoes.includes(l) ? 0.4 : 1 }} onClick={() => toggle("lesoes", l)}>
                  <i style={{ background: c.lesao[l] }} />
                  {l}
                </button>
              ))}
            </div>
          </>
        ) : (
          <Empty />
        )}
      </Card>

      <Card title="Acidentes por dia da semana" extra={ex("clique para filtrar")} className={col(4)}>
        {semana.some((s) => s.value) ? (
          <div style={{ height: alt }}>
            <ResponsiveContainer>
              <ComposedChart data={semana} margin={{ top: 22, right: 6, left: 6, bottom: 0 }}>
                <defs><Grad id="wk" color={c.bar} /></defs>
                <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="3 5" />
                <XAxis dataKey="nome" tick={axis} axisLine={false} tickLine={false} />
                <YAxis hide domain={[0, "dataMax + 2"]} />
                <Tooltip cursor={{ fill: c.cursor, radius: 8 }} content={<ChartTip />} labelFormatter={(_, p) => p?.[0]?.payload?.dia} />
                <Bar dataKey="value" name="Eventos" fill="url(#wk)" maxBarSize={34} radius={[8, 8, 0, 0]} style={{ cursor: "pointer" }} onClick={(d: any) => toggle("dias", d.dia)}>
                  {semana.map((s) => (
                    <Cell key={s.dia} fill="url(#wk)" fillOpacity={filtros.dias.length > 0 && !filtros.dias.includes(s.dia) ? ESMAECIDO : 1} />
                  ))}
                  <LabelList dataKey="value" position="top" fill={c.text} fontSize={12} fontWeight={700} />
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty />
        )}
      </Card>

      <Card title="Eventos por gerência" className={col(4)}><Donut data={processo} selected={filtros.gerencias} onPick={(n) => toggle("gerencias", n)} /></Card>
      <Card title="Tipologia dos eventos" className={col(4)}><Donut data={tipo} selected={filtros.tipos} onPick={(n) => toggle("tipos", n)} /></Card>
      <Card title="Envolvimento de terceiros" className={col(4)}><Donut data={terceiros} selected={filtros.envolvidos} onPick={(n) => toggle("envolvidos", n)} /></Card>

      <Card title="Eventos por base" extra={ex("passe o mouse para ver a tipologia")} className={col(4)}>
        <Rank limit={topo} data={base} selected={filtros.bases} onPick={(n) => toggle("bases", n)} detail={compacto ? undefined : tipologiaDe(baseRegs, "base")} />
      </Card>
      <Card title="Eventos por equipe" extra={ex("passe o mouse para ver a tipologia")} className={col(4)}>
        <Rank limit={topo} data={equipes} selected={filtros.equipes} onPick={(n) => toggle("equipes", n)} detail={compacto ? undefined : tipologiaDe(equipeRegs, "prefixo")} />
      </Card>

      <Card title="Eventos por colaborador" extra={ex("passe o mouse para ver a tipologia")} className={col(4)}>
        <Rank limit={topo} data={colaboradores} selected={filtros.colaboradores} onPick={(n) => toggle("colaboradores", n)} detail={compacto ? undefined : tipologiaDe(colabRegs, "colaborador")} />
      </Card>

      <Card title="Tipologia detalhada" extra={ex("clique para filtrar")} className={col(6)}>
        <Rank limit={topo} data={carac} selected={filtros.caracteristicas} onPick={(n) => toggle("caracteristicas", n)} />
      </Card>
      <Card title="Resumo" extra={ex("definição do evento · clique para filtrar")} className={col(6)}>
        <Rank limit={topo} data={resumoDef} selected={filtros.definicoes} onPick={(n) => toggle("definicoes", n)} />
      </Card>
    </div>
  );
}
