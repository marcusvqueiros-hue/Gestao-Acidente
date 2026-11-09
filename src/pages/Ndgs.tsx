import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileUp, Trash2 } from "lucide-react";
import { useData } from "../lib/store";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { Card, ChartTip, Chips, Empty, Toast } from "../components/ui";
import { MESES, type NdgsMes } from "../types";
import { COR_SITUACAO, IDS, INDICES, ROTULO_SITUACAO, calcularNdgs, lerPercentual, media, pct, situacao, valorDe, type IndiceId, type SerieId } from "../lib/ndgs";
import { Grad } from "./Dashboard";

const NOME: Record<SerieId, string> = { ndgs: "NDGS", icad: "ICAD", icit: "ICIT", icia: "ICIA", tfa: "TFA", tga: "TGA", ipws: "IPWS" };
const MESES_COMPLETOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function Grafico({ meses, serie, className }: { meses: NdgsMes[]; serie: SerieId; className: string }) {
  const { c } = useTheme();
  const axis = { fontSize: 12, fill: c.text };
  const dados = meses
    .map((m) => ({ nome: MESES[m.mes - 1], v: valorDe(m, serie) }))
    .filter((d): d is { nome: string; v: number } => d.v != null);
  const rotulo = (p: any) => {
    const d = dados[p.index];
    if (!d) return null;
    return (
      <text x={p.x + p.width / 2} y={p.y - 7} textAnchor="middle" fontSize={11} fontWeight={700} fill={c.text}>
        {pct(d.v)}
      </text>
    );
  };
  return (
    <Card title={NOME[serie]} className={className}>
      {dados.length ? (
        <div style={{ height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={dados} margin={{ top: 26, right: 4, left: 4, bottom: 0 }}>
              <defs>
                {(["atende", "parcial", "nao"] as const).map((s) => <Grad key={s} id={`nd-${serie}-${s}`} color={COR_SITUACAO[s]} />)}
              </defs>
              <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="3 5" />
              <XAxis dataKey="nome" tick={axis} axisLine={false} tickLine={false} interval={0} />
              <YAxis hide domain={[0, 1.12]} />
              <Tooltip
                cursor={{ fill: c.cursor, radius: 8 }}
                content={(p: any) => (
                  <ChartTip active={p.active} label={p.label} payload={p.payload?.map((x: any) => ({ ...x, value: x.payload.v, name: NOME[serie] }))} fmt={(v) => pct(v)} />
                )}
              />
              <Bar dataKey="v" name={NOME[serie]} maxBarSize={44} minPointSize={2} radius={[8, 8, 0, 0]} isAnimationActive={false}>
                {dados.map((d, i) => <Cell key={i} fill={`url(#nd-${serie}-${situacao(d.v)})`} />)}
                <LabelList dataKey="v" content={rotulo} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <Empty />
      )}
    </Card>
  );
}

/* ---------- leitura da planilha ---------- */
const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");
const chave = (t: string) => sem(String(t ?? "")).toUpperCase().replace(/[^A-Z0-9]/g, "");

function nota(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? (v > 1 ? v / 100 : v) : null;
  const t = String(v).trim();
  if (!t) return null;
  const n = Number(t.replace("%", "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return t.includes("%") || n > 1 ? n / 100 : n;
}

function mesDe(v: unknown, SSF: { parse_date_code: (n: number) => { y: number; m: number } | null }): { mes: number; ano?: number } | null {
  if (typeof v === "number") {
    if (v >= 1 && v <= 12) return { mes: v };
    const d = SSF.parse_date_code(v);
    return d ? { mes: d.m, ano: d.y } : null;
  }
  const t = sem(String(v ?? "")).toLowerCase().trim();
  if (!t) return null;
  const nome = MESES.findIndex((m) => t.startsWith(sem(m).toLowerCase()));
  if (nome >= 0) return { mes: nome + 1 };
  const br = t.match(/^(\d{1,2})[/-](\d{4})$/) ?? t.match(/^\d{1,2}[/-](\d{1,2})[/-](\d{4})$/);
  if (br) return { mes: Number(br[1]), ano: Number(br[2]) };
  const iso = t.match(/^(\d{4})-(\d{2})/);
  if (iso) return { mes: Number(iso[2]), ano: Number(iso[1]) };
  const n = Number(t);
  return Number.isInteger(n) && n >= 1 && n <= 12 ? { mes: n } : null;
}

const pctTexto = (v: number | null | undefined) => (v == null ? "" : (v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2, useGrouping: false }));

export default function Ndgs() {
  const { data, setNdgs, removeNdgs } = useData();
  const { admin } = useAuth();
  const todos = data.ndgs ?? [];
  const hoje = new Date().getFullYear();
  const anos = useMemo(() => [...new Set([...todos.map((m) => m.ano), hoje])].sort(), [todos, hoje]);
  const [ano, setAno] = useState(() => (todos.length ? todos[todos.length - 1].ano : hoje));
  const iniciou = useRef(false);
  useEffect(() => {
    if (iniciou.current || !todos.length) return;
    iniciou.current = true;
    setAno(todos[todos.length - 1].ano);
  }, [todos]);

  const doAno = useMemo(() => todos.filter((m) => m.ano === ano).sort((a, b) => a.mes - b.mes), [todos, ano]);
  const [toast, setToast] = useState("");
  const [lote, setLote] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  // valores digitados e ainda não salvos: mês → índice → texto em %
  const [rascunho, setRascunho] = useState<Record<number, Partial<Record<SerieId, string>>>>({});
  useEffect(() => setRascunho({}), [ano]);
  const existente = (mes: number) => doAno.find((m) => m.mes === mes);
  const texto = (mes: number, id: SerieId) => rascunho[mes]?.[id] ?? pctTexto(id === "ndgs" ? existente(mes)?.valor : existente(mes)?.[id]);
  const mudou = (mes: number) => {
    const r = rascunho[mes];
    if (!r) return false;
    return (Object.keys(r) as SerieId[]).some((id) => {
      const novo = lerPercentual(r[id] ?? "");
      const atual = (id === "ndgs" ? existente(mes)?.valor : existente(mes)?.[id]) ?? null;
      return Number.isNaN(novo) || (novo ?? null) !== atual;
    });
  };
  const pendentes = MESES.map((_, i) => i + 1).filter(mudou);

  function montar(mes: number): NdgsMes | string {
    const m: NdgsMes = { ano, mes };
    for (const id of [...IDS, "ndgs"] as SerieId[]) {
      const v = lerPercentual(texto(mes, id));
      if (Number.isNaN(v)) return `${MESES[mes - 1]}: valor inválido em ${NOME[id]}`;
      if (id === "ndgs") m.valor = v;
      else m[id] = v;
    }
    return m;
  }

  async function salvar(meses: number[]) {
    const lista: NdgsMes[] = [];
    const apagar: number[] = [];
    for (const mes of meses) {
      const m = montar(mes);
      if (typeof m === "string") return setToast(m);
      if ([...IDS.map((i) => m[i]), m.valor].every((v) => v == null)) apagar.push(mes);
      else lista.push(m);
    }
    const e = await setNdgs(lista);
    if (e) return setToast(e);
    for (const mes of apagar) {
      const e2 = await removeNdgs(ano, mes);
      if (e2) return setToast(e2);
    }
    setRascunho((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !meses.includes(Number(k)))));
    setToast(meses.length === 1 ? `${MESES_COMPLETOS[meses[0] - 1]}/${ano} salvo` : `${meses.length} meses salvos`);
  }

  async function importar(f: File) {
    setOcupado(true);
    setLote("Lendo a planilha…");
    try {
      const X = await import("xlsx");
      const wb = X.read(await f.arrayBuffer());
      const nomeAba = wb.SheetNames.find((n) => chave(n) === "BASE") ?? wb.SheetNames[0];
      // o cabeçalho pode não estar na primeira linha da aba: procura a linha com MÊS e as colunas de nota
      const grade = X.utils.sheet_to_json<unknown[]>(wb.Sheets[nomeAba], { header: 1, defval: "" });
      const chaves = (l: unknown[]) => l.map((h) => chave(String(h ?? "")));
      const cab = grade.findIndex((l) => chaves(l).includes("MES") && chaves(l).some((h) => h.startsWith("NOTA") || h === "VALOR"));
      if (cab < 0) {
        setLote("Cabeçalho não encontrado. A planilha precisa das colunas MÊS, ANO, NOTA ICAD, NOTA ICIT, NOTA ICIA, NOTA TFA, NOTA TGA, NOTA IPWS e VALOR.");
        return;
      }
      const titulos = chaves(grade[cab]);
      const linhas = grade.slice(cab + 1).map((l) => Object.fromEntries(titulos.map((t, i) => [t, l[i]])) as Record<string, unknown>);
      const porMes = new Map<string, NdgsMes>();
      for (const l of linhas) {
        const k = l;
        const mm = mesDe(k.MES, X.SSF as never);
        if (!mm) continue;
        const a = Number(k.ANO) || mm.ano || ano;
        const m: NdgsMes = {
          ano: a,
          mes: mm.mes,
          icad: nota(k.NOTAICAD ?? k.ICAD),
          icit: nota(k.NOTAICIT ?? k.ICIT),
          icia: nota(k.NOTAICIA ?? k.ICIA),
          tfa: nota(k.NOTATFA ?? k.TFA),
          tga: nota(k.NOTATGA ?? k.TGA),
          ipws: nota(k.NOTAIPWS ?? k.IPWS),
          valor: nota(k.VALOR ?? k.NDGS),
        };
        if ([m.icad, m.icit, m.icia, m.tfa, m.tga, m.ipws, m.valor].every((v) => v == null)) continue;
        porMes.set(`${a}-${mm.mes}`, m);
      }
      const lista = [...porMes.values()];
      if (!lista.length) {
        setLote("Nenhuma linha encontrada. A planilha precisa das colunas MÊS, ANO, NOTA ICAD, NOTA ICIT, NOTA ICIA, NOTA TFA, NOTA TGA, NOTA IPWS e VALOR.");
        return;
      }
      const e = await setNdgs(lista);
      if (e) return setLote(e);
      setAno(Math.max(...lista.map((m) => m.ano)));
      setLote(`${lista.length} mês(es) importado(s) da aba "${nomeAba}". Meses já existentes foram atualizados.`);
    } catch (e) {
      setLote("Não foi possível ler a planilha: " + (e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  async function excluir(mes: number) {
    if (!confirm(`Excluir os dados de ${MESES_COMPLETOS[mes - 1]}/${ano}?`)) return;
    const e = await removeNdgs(ano, mes);
    setToast(e ?? "Mês excluído");
  }

  const series: SerieId[] = ["ndgs", ...IDS];

  return (
    <>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <Chips options={anos} selected={[ano]} onToggle={(a) => setAno(a)} />
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
        {series.map((id) => {
          const v = media(doAno, id);
          const s = v == null ? null : situacao(v);
          return (
            <div key={id} className="ndgs-kpi" style={{ ["--c" as string]: s ? COR_SITUACAO[s] : "var(--line)" }}>
              <small>Média {NOME[id]}</small>
              <b>{pct(v)}</b>
              {s && <small>{ROTULO_SITUACAO[s]}</small>}
            </div>
          );
        })}
      </div>

      <div className="grid">
        <Grafico meses={doAno} serie="ndgs" className="s4" />
        <Grafico meses={doAno} serie="icad" className="s4" />
        <Grafico meses={doAno} serie="icit" className="s4" />
        <Grafico meses={doAno} serie="icia" className="s3" />
        <Grafico meses={doAno} serie="ipws" className="s3" />
        <Grafico meses={doAno} serie="tfa" className="s3" />
        <Grafico meses={doAno} serie="tga" className="s3" />

        {admin && (
          <Card title={`Atualizar dados de ${ano}`} extra="notas em % (ex.: 93 ou 93,5)" className="s12">
            <div className="table-wrap">
              <table className="calc">
                <thead>
                  <tr>
                    <th>Mês</th>
                    {IDS.map((id) => <th key={id} className="num" title={INDICES.find((i) => i.id === id)?.descricao}>{NOME[id]} (%)</th>)}
                    <th className="num" title="Calculado pela fórmula; digite para informar o valor oficial">NDGS (%)</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {MESES.map((nome, i) => {
                    const mes = i + 1;
                    const calc = calcularNdgs(Object.fromEntries(IDS.map((id) => [id, lerPercentual(texto(mes, id))]).map(([k, v]) => [k, Number.isNaN(v) ? null : v])) as Record<IndiceId, number | null>);
                    const tem = !!existente(mes);
                    return (
                      <tr key={mes}>
                        <td>{nome}</td>
                        {IDS.map((id) => (
                          <td key={id} className="num">
                            <input
                              className="input h-input"
                              style={{ width: 88 }}
                              inputMode="decimal"
                              placeholder="—"
                              value={texto(mes, id)}
                              aria-label={`${NOME[id]} de ${nome}/${ano}`}
                              onChange={(e) => setRascunho((r) => ({ ...r, [mes]: { ...r[mes], [id]: e.target.value } }))}
                            />
                          </td>
                        ))}
                        <td className="num">
                          <input
                            className="input h-input"
                            style={{ width: 96 }}
                            inputMode="decimal"
                            placeholder={calc != null ? pctTexto(calc) : "—"}
                            value={texto(mes, "ndgs")}
                            aria-label={`NDGS de ${nome}/${ano}`}
                            onChange={(e) => setRascunho((r) => ({ ...r, [mes]: { ...r[mes], ndgs: e.target.value } }))}
                          />
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className={`btn ${mudou(mes) ? "primary" : ""}`} style={{ padding: "5px 12px" }} disabled={!mudou(mes)} onClick={() => salvar([mes])}>Salvar</button>
                          {tem && <button className="icon-btn" style={{ display: "inline-grid", marginLeft: 6 }} onClick={() => excluir(mes)} aria-label={`Excluir ${nome}/${ano}`} title="Excluir o mês"><Trash2 size={15} /></button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="calc-fill">
              <button className="btn primary" disabled={!pendentes.length} onClick={() => salvar(pendentes)}>Salvar todas as alterações{pendentes.length ? ` (${pendentes.length})` : ""}</button>
              <small style={{ color: "var(--muted)" }}>O NDGS é calculado com os seis índices; se você digitar um valor na coluna NDGS, ele passa a ser o oficial do mês (apague para voltar ao calculado).</small>
            </div>
          </Card>
        )}

        <Card title="Como o NDGS é composto" className="s7">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Índice</th><th>Descrição</th><th className="num">Peso</th><th>Verificação</th></tr></thead>
              <tbody>
                {INDICES.map((i) => (
                  <tr key={i.id}><td><b>{i.nome}</b></td><td>{i.descricao}</td><td className="num">{i.peso * 100}%</td><td>{i.verificacao}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint-inline" style={{ marginTop: 10 }}>NDGS = ICAD × 0,20 + ICIT × 0,20 + ICIA × 0,10 + TFA × 0,15 + TGA × 0,25 + IPWS × 0,10</p>
        </Card>

        <Card title="Legenda" className="s5">
          <ul className="formulas">
            {(["atende", "parcial", "nao"] as const).map((s) => (
              <li key={s} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <i style={{ width: 14, height: 14, borderRadius: 4, background: COR_SITUACAO[s], display: "inline-block" }} />
                <b>{ROTULO_SITUACAO[s]}</b> — {s === "atende" ? "NDGS ≥ 90%" : s === "parcial" ? "70% ≤ NDGS < 90%" : "NDGS < 70%"}
              </li>
            ))}
          </ul>
          <p className="hint-inline" style={{ marginTop: 10 }}>As mesmas faixas colorem os gráficos e as médias de cada índice.</p>
        </Card>
      </div>
      {toast && <Toast msg={toast} onDone={() => setToast("")} />}
    </>
  );
}
