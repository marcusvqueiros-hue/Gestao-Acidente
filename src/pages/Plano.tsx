import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Check, FileUp, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useData } from "../lib/store";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { fmtData } from "../lib/stats";
import { Card, ChartTip, Chips, Empty, Toast } from "../components/ui";
import { BASES, type AcaoPlano, type Registro, type SituacaoAcao } from "../types";
import { COR_SIT, ROTULO_SIT, SITUACOES, chaveAcao, hojeISO, lerPlanilha, novoIdAcao, situacaoEfetiva, sinistroDa } from "../lib/plano";

type Linha = { tipo: "acao"; a: AcaoPlano; s?: Registro; sit: SituacaoAcao } | { tipo: "sem"; s: Registro };
type Filtro = "todas" | SituacaoAcao | "SEM";

const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: "todas", rotulo: "Todas" },
  { id: "CONCLUIDO", rotulo: "Concluídas" },
  { id: "EM ANDAMENTO", rotulo: "Em andamento" },
  { id: "PENDENTE", rotulo: "Pendentes" },
  { id: "ATRASADO", rotulo: "Atrasadas" },
  { id: "SEM", rotulo: "Sinistros sem plano" },
];

const Selo = ({ sit }: { sit: SituacaoAcao }) => (
  <span className="badge" style={{ background: COR_SIT[sit] + "33", color: COR_SIT[sit], fontWeight: 700, whiteSpace: "nowrap" }}>{ROTULO_SIT[sit]}</span>
);

export default function Plano() {
  const { data, setAcoes, removeAcao } = useData();
  const { admin } = useAuth();
  const { c } = useTheme();
  const acoes = data.acoes ?? [];
  const hoje = hojeISO();
  const hojeAno = Number(hoje.slice(0, 4));

  const anos = useMemo(() => [...new Set([...acoes.map((a) => Number(a.dataEvento.slice(0, 4))), ...data.registros.filter((r) => r.categoria === "acidente").map((r) => Number(r.data.slice(0, 4))), hojeAno])].filter(Boolean).sort(), [acoes, data.registros, hojeAno]);
  const [ano, setAno] = useState(hojeAno);
  const iniciou = useRef(false);
  useEffect(() => {
    if (iniciou.current || !acoes.length) return;
    iniciou.current = true;
    setAno(Math.max(...acoes.map((a) => Number(a.dataEvento.slice(0, 4)))));
  }, [acoes]);

  const [base, setBase] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [toast, setToast] = useState("");
  const [lote, setLote] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  const [rascunho, setRascunho] = useState<Record<string, Partial<AcaoPlano>>>({});
  useEffect(() => setRascunho({}), [ano]);

  // sinistros do ano e ações ligadas a eles
  const sinistros = useMemo(() => data.registros.filter((r) => r.categoria === "acidente" && r.data.startsWith(String(ano))), [data.registros, ano]);
  const doAno = useMemo(() => acoes.filter((a) => a.dataEvento.startsWith(String(ano))), [acoes, ano]);
  const ligadas = useMemo(() => doAno.map((a) => ({ a, s: sinistroDa(a, sinistros), sit: situacaoEfetiva(a, hoje) })), [doAno, sinistros, hoje]);
  const semPlano = useMemo(() => {
    const com = new Set(ligadas.map((x) => x.s?.id).filter(Boolean));
    return sinistros.filter((s) => !com.has(s.id));
  }, [ligadas, sinistros]);

  const cont = (sit: SituacaoAcao) => ligadas.filter((x) => x.sit === sit).length;
  const total = ligadas.length;
  const concluidas = cont("CONCLUIDO");
  const pctConcl = total ? Math.round((concluidas / total) * 100) : 0;

  const donut = SITUACOES.map((s) => ({ name: ROTULO_SIT[s], value: cont(s), sit: s })).filter((d) => d.value > 0);
  const porBase = useMemo(() => {
    const bases = [...new Set([...BASES, ...ligadas.map((x) => x.a.base).filter(Boolean)])];
    return bases
      .map((b) => ({ base: b, ...Object.fromEntries(SITUACOES.map((s) => [s, ligadas.filter((x) => x.a.base === b && x.sit === s).length])) }) as Record<string, number | string>)
      .filter((d) => SITUACOES.some((s) => (d[s] as number) > 0));
  }, [ligadas]);

  const linhas = useMemo<Linha[]>(() => {
    const l: Linha[] = [
      ...ligadas.map((x) => ({ tipo: "acao" as const, ...x })),
      ...semPlano.map((s) => ({ tipo: "sem" as const, s })),
    ];
    const dataDe = (x: Linha) => (x.tipo === "acao" ? x.a.dataEvento : x.s.data);
    const nomeDe = (x: Linha) => (x.tipo === "acao" ? x.a.nome : x.s.colaborador);
    return l
      .filter((x) => {
        const b = x.tipo === "acao" ? x.a.base : x.s.base;
        if (base && b !== base) return false;
        if (filtro === "todas") return true;
        if (filtro === "SEM") return x.tipo === "sem";
        return x.tipo === "acao" && x.sit === filtro;
      })
      .sort((a, b) => dataDe(b).localeCompare(dataDe(a)) || nomeDe(a).localeCompare(nomeDe(b)));
  }, [ligadas, semPlano, base, filtro]);

  const valor = <K extends keyof AcaoPlano>(a: AcaoPlano, k: K): AcaoPlano[K] => (rascunho[a.id]?.[k] ?? a[k]) as AcaoPlano[K];
  const mudou = (a: AcaoPlano) => !!rascunho[a.id] && (Object.keys(rascunho[a.id]) as (keyof AcaoPlano)[]).some((k) => (rascunho[a.id][k] ?? "") !== (a[k] ?? ""));
  const editar = (a: AcaoPlano, parte: Partial<AcaoPlano>) => setRascunho((r) => ({ ...r, [a.id]: { ...r[a.id], ...parte } }));
  const pendentes = ligadas.map((x) => x.a).filter(mudou);

  const montar = (a: AcaoPlano, extra: Partial<AcaoPlano> = {}): AcaoPlano => {
    const m: AcaoPlano = { ...a, ...rascunho[a.id], ...extra };
    if (m.situacao === "CONCLUIDO") m.concluidoEm = m.concluidoEm || hoje;
    else m.concluidoEm = null;
    if (!m.prazo) m.prazo = null;
    return m;
  };

  async function salvar(lista: AcaoPlano[], msg: string) {
    const e = await setAcoes(lista);
    if (e) return setToast(e);
    setRascunho((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !lista.some((a) => a.id === k))));
    setToast(msg);
  }

  async function adicionar(s: Registro) {
    const nova: AcaoPlano = { id: novoIdAcao(), registroId: s.id, dataEvento: s.data, nome: s.colaborador, area: "", acao: "", base: s.base, responsavel: "", prazo: null, situacao: "PENDENTE", concluidoEm: null };
    const e = await setAcoes([nova]);
    setToast(e ?? "Ação adicionada: preencha os campos e salve");
  }

  async function excluir(a: AcaoPlano) {
    if (!confirm("Excluir esta ação do plano?")) return;
    const e = await removeAcao(a.id);
    setToast(e ?? "Ação excluída");
  }

  async function importar(f: File) {
    setOcupado(true);
    setLote("Lendo a planilha…");
    try {
      const X = await import("xlsx");
      const wb = X.read(await f.arrayBuffer());
      const grade = X.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
      const r = lerPlanilha(grade, X.SSF as never);
      if (!r) return setLote("Cabeçalho não encontrado. A planilha precisa das colunas DATA DO EVENTO, NOME, ÁREAS DE CONTROLE, AÇÃO DE MELHORIAS, BASE, RESPONSÁVEL, DATA PREVISTA e SITUAÇÃO ATUAL.");
      const existentes = new Set(acoes.map(chaveAcao));
      const novas = r.acoes.filter((a) => !existentes.has(chaveAcao(a)));
      const e = await setAcoes(novas);
      if (e) return setLote(e);
      setLote(`${novas.length} ação(ões) importada(s), ${r.acoes.length - novas.length} já existia(m)${r.ignoradas ? `, ${r.ignoradas} linha(s) ignorada(s) sem data ou ação` : ""}.`);
      if (novas.length) setAno(Math.max(...novas.map((a) => Number(a.dataEvento.slice(0, 4)))));
    } catch (e) {
      setLote("Não foi possível ler a planilha: " + (e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  const axis = { fontSize: 12, fill: c.text };
  const areas = useMemo(() => [...new Set(acoes.map((a) => a.area).filter(Boolean))].sort(), [acoes]);
  const colunas = ["Data do evento", "Nome", "Áreas de controle", "Ação de melhoria", "Base", "Responsável pela execução", "Prazo (conclusão)", "Situação atual"];

  return (
    <>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <Chips options={anos} selected={[ano]} onToggle={(a) => setAno(a)} />
        <select className="select" style={{ width: "auto", minWidth: 150 }} value={base} onChange={(e) => setBase(e.target.value)} aria-label="Filtrar por base">
          <option value="">Base: todas</option>
          {BASES.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <div className="grow" />
        {admin && (
          <>
            <input ref={arquivo} type="file" accept=".xlsx,.xlsm,.xls" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = ""; }} />
            <button className="btn" disabled={ocupado} onClick={() => arquivo.current?.click()}><FileUp size={15} /> Importar planilha</button>
          </>
        )}
      </div>
      {lote && <div className="foto-prog" role="status" style={{ marginBottom: 12 }}>{lote}</div>}

      <div className="ndgs-kpis">
        {[
          { rotulo: "Ações no plano", v: total, cor: "var(--line)", sub: `${sinistros.length} sinistro(s) em ${ano}` },
          { rotulo: "Concluídas", v: concluidas, cor: COR_SIT.CONCLUIDO, sub: `${pctConcl}% do total` },
          { rotulo: "Em andamento", v: cont("EM ANDAMENTO"), cor: COR_SIT["EM ANDAMENTO"], sub: "dentro do prazo" },
          { rotulo: "Pendentes", v: cont("PENDENTE"), cor: COR_SIT.PENDENTE, sub: "ainda não iniciadas" },
          { rotulo: "Atrasadas", v: cont("ATRASADO"), cor: COR_SIT.ATRASADO, sub: "prazo vencido" },
          { rotulo: "Sinistros sem plano", v: semPlano.length, cor: semPlano.length ? COR_SIT.ATRASADO : COR_SIT.CONCLUIDO, sub: semPlano.length ? "cadastre as ações" : "todos com plano" },
        ].map((k) => (
          <div key={k.rotulo} className="ndgs-kpi" style={{ ["--c" as string]: k.cor }}>
            <small>{k.rotulo}</small>
            <b>{k.v}</b>
            <small>{k.sub}</small>
          </div>
        ))}
      </div>

      <div className="grid">
        <Card title="Situação das ações" className="s5">
          {donut.length ? (
            <div className="donut" style={{ height: 260 }}>
              <ResponsiveContainer>
                <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                  <Pie data={donut} dataKey="value" nameKey="name" innerRadius={62} outerRadius={100} paddingAngle={2} cornerRadius={5} stroke="none" isAnimationActive={false} label={({ value }: { value?: number }) => String(value ?? "")} labelLine={false}>
                    {donut.map((d) => <Cell key={d.sit} fill={COR_SIT[d.sit]} />)}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                  <Legend verticalAlign="bottom" iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12, color: c.text }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="center" style={{ top: "36%" }}>
                <b>{pctConcl}%</b>
                <small>concluído</small>
              </div>
            </div>
          ) : (
            <Empty />
          )}
        </Card>

        <Card title="Ações por base" className="s7">
          {porBase.length ? (
            <div style={{ height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={porBase} margin={{ top: 10, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="3 5" />
                  <XAxis dataKey="base" tick={axis} axisLine={false} tickLine={false} />
                  <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: c.cursor, radius: 8 }} content={<ChartTip />} />
                  <Legend verticalAlign="bottom" iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12, color: c.text }} />
                  {SITUACOES.map((s) => (
                    <Bar key={s} dataKey={s} name={ROTULO_SIT[s]} stackId="p" fill={COR_SIT[s]} maxBarSize={46} isAnimationActive={false}>
                      <LabelList dataKey={s} position="center" formatter={(v: unknown) => (Number(v) ? String(v) : "")} fill="#1d1a1f" fontSize={11} fontWeight={700} />
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty />
          )}
        </Card>

        <Card title="Plano de ação dos sinistros" extra={`${linhas.length} linha(s)`} className="s12">
          <div className="seg" role="group" aria-label="Filtrar por situação" style={{ marginBottom: 12, flexWrap: "wrap" }}>
            {FILTROS.map((f) => (
              <button key={f.id} className={filtro === f.id ? "on" : ""} onClick={() => setFiltro(f.id)}>{f.rotulo}</button>
            ))}
          </div>
          {linhas.length ? (
            <div className="table-wrap table-scroll" style={{ maxHeight: "70vh" }}>
              <table className="plano-tabela" style={{ minWidth: 1180 }}>
                <thead>
                  <tr>
                    {colunas.map((t) => <th key={t}>{t}</th>)}
                    {admin && <th>Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((x) => {
                    if (x.tipo === "sem") {
                      return (
                        <tr key={"s" + x.s.id} style={{ background: "rgb(217 72 95 / 0.07)" }}>
                          <td>{fmtData(x.s.data)}</td>
                          <td><b>{x.s.colaborador}</b></td>
                          <td colSpan={5} style={{ color: "var(--muted)" }}>Plano de ação ainda não cadastrado para este sinistro ({x.s.caracteristica || x.s.tipo || "—"})</td>
                          <td><Selo sit="PENDENTE" /></td>
                          {admin && <td><button className="btn" style={{ padding: "5px 12px" }} onClick={() => adicionar(x.s)}><Plus size={14} /> Adicionar ação</button></td>}
                        </tr>
                      );
                    }
                    const a = x.a;
                    const m = mudou(a);
                    const sit = situacaoEfetiva({ ...a, situacao: valor(a, "situacao"), prazo: valor(a, "prazo") }, hoje);
                    return (
                      <tr key={a.id}>
                        {admin ? (
                          <>
                            <td><input className="input" type="date" value={valor(a, "dataEvento")} onChange={(e) => editar(a, { dataEvento: e.target.value })} style={{ width: 128 }} aria-label="Data do evento" /></td>
                            <td><input className="input" value={valor(a, "nome")} onChange={(e) => editar(a, { nome: e.target.value })} style={{ width: 150 }} aria-label="Nome" /></td>
                            <td><input className="input" list="plano-areas" value={valor(a, "area")} onChange={(e) => editar(a, { area: e.target.value })} style={{ width: 140 }} aria-label="Áreas de controle" /></td>
                            <td><textarea className="input" rows={3} value={valor(a, "acao")} onChange={(e) => editar(a, { acao: e.target.value })} style={{ width: 250, resize: "vertical" }} aria-label="Ação de melhoria" /></td>
                            <td>
                              <select className="select" value={valor(a, "base")} onChange={(e) => editar(a, { base: e.target.value })} style={{ width: 72 }} aria-label="Base">
                                <option value="">—</option>
                                {[...new Set([...BASES, valor(a, "base")])].filter(Boolean).map((b) => <option key={b} value={b}>{b}</option>)}
                              </select>
                            </td>
                            <td><input className="input" value={valor(a, "responsavel")} onChange={(e) => editar(a, { responsavel: e.target.value })} style={{ width: 150 }} aria-label="Responsável pela execução" /></td>
                            <td><input className="input" type="date" value={valor(a, "prazo") ?? ""} onChange={(e) => editar(a, { prazo: e.target.value || null })} style={{ width: 128 }} aria-label="Prazo de conclusão" /></td>
                            <td>
                              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                                <select className="select" value={valor(a, "situacao") === "ATRASADO" ? "EM ANDAMENTO" : valor(a, "situacao")} onChange={(e) => editar(a, { situacao: e.target.value as SituacaoAcao })} style={{ width: 130 }} aria-label="Situação atual">
                                  {(["CONCLUIDO", "EM ANDAMENTO", "PENDENTE"] as SituacaoAcao[]).map((s) => <option key={s} value={s}>{ROTULO_SIT[s]}</option>)}
                                </select>
                                {sit === "ATRASADO" && <Selo sit="ATRASADO" />}
                              </div>
                            </td>
                            <td>
                              <div className="plano-acoes">
                                {a.situacao !== "CONCLUIDO" ? (
                                  <button className="btn primary" onClick={() => salvar([montar(a, { situacao: "CONCLUIDO" })], "Ação concluída")} title="Marcar como concluída"><Check size={14} /> Concluir</button>
                                ) : (
                                  <button className="btn" onClick={() => salvar([montar(a, { situacao: "EM ANDAMENTO" })], "Ação reaberta")} title="Reabrir a ação"><RotateCcw size={14} /> Reabrir</button>
                                )}
                                <button className={`btn ${m ? "primary" : ""}`} disabled={!m} onClick={() => salvar([montar(a)], "Ação salva")}>Salvar</button>
                                <button className="btn" onClick={() => excluir(a)} title="Excluir a ação"><Trash2 size={14} /> Excluir</button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td>{fmtData(a.dataEvento)}</td>
                            <td><b>{a.nome}</b></td>
                            <td>{a.area}</td>
                            <td style={{ minWidth: 300, whiteSpace: "normal" }}>{a.acao}</td>
                            <td>{a.base}</td>
                            <td>{a.responsavel}</td>
                            <td>{a.prazo ? fmtData(a.prazo) : "—"}</td>
                            <td><Selo sit={sit} /></td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <datalist id="plano-areas">{areas.map((a) => <option key={a} value={a} />)}</datalist>
            </div>
          ) : (
            <Empty />
          )}
          {admin && (
            <div className="calc-fill">
              <button className="btn primary" disabled={!pendentes.length} onClick={() => salvar(pendentes.map((a) => montar(a)), `${pendentes.length} ação(ões) salva(s)`)}>Salvar todas as alterações{pendentes.length ? ` (${pendentes.length})` : ""}</button>
              <small style={{ color: "var(--muted)" }}>Ações não concluídas com prazo vencido aparecem como atrasadas automaticamente. Concluir grava a data de hoje como conclusão.</small>
            </div>
          )}
        </Card>
      </div>
      {toast && <Toast msg={toast} onDone={() => setToast("")} />}
    </>
  );
}
