import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Calculator, TriangleAlert } from "lucide-react";
import { useData } from "../lib/store";
import { useAuth } from "../lib/auth";
import { useFiltros } from "../lib/filters";
import { fmtNum } from "../lib/stats";
import { contarMes, serieTaxas, somar, taxasDe, type TaxaMes } from "../lib/taxas";
import { MESES, TIPOS } from "../types";
import { useTheme } from "../lib/theme";
import { Card, ChartTip, Chips, Empty, Toast } from "../components/ui";
import { Grad } from "./Dashboard";

type Campo = "tf" | "tfca" | "tg";

function RateChart({ rows, campo, titulo, completo }: { rows: TaxaMes[]; campo: Campo; titulo: string; completo?: boolean }) {
  const { c } = useTheme();
  const axis = { fontSize: 12, fill: c.text };
  const multi = new Set(rows.map((t) => t.ano)).size > 1;
  const metaDe = (t: TaxaMes) => (campo === "tg" ? t.metaTg : t.metaTf);
  const m = rows.length ? metaDe(rows[rows.length - 1]) : 0;
  const valores = rows.map((t) => t[campo]).filter((v): v is number => v != null);
  const maxV = Math.max(0, ...valores);
  // eixo ajustado: valores muito acima da meta (ex.: mês com óbito) são cortados para as taxas baixas ficarem legíveis
  const base = Math.max(m * 3.5, 1);
  const corta = !completo && maxV > base * 1.5;
  const teto = corta ? Math.ceil(base / 5) * 5 : Math.max(Math.ceil(maxV * 1.1), Math.ceil(m * 1.3), 1);
  const dados = rows.map((t) => {
    const v = t[campo];
    return { nome: multi ? `${MESES[t.mes - 1]}/${String(t.ano).slice(2)}` : MESES[t.mes - 1], v, plot: v == null ? 0 : Math.min(v, teto), meta: metaDe(t), cortado: v != null && v > teto, origem: t.origem };
  });
  const comValor = dados.filter((r) => r.v != null);
  const acima = comValor.filter((r) => (r.v as number) > r.meta).length;
  const dec = campo === "tg" ? 0 : 2;
  const rotulo = (p: any) => {
    const row = dados[p.index];
    if (!row) return null;
    return (
      <text x={p.x + p.width / 2} y={p.y - 7} textAnchor="middle" fontSize={11} fontWeight={600} fill={row.cortado ? c.bad : c.text}>
        {row.v == null ? "—" : fmtNum(row.v, dec)}{row.cortado ? " ▲" : ""}
      </text>
    );
  };
  return (
    <Card title={titulo} extra={comValor.length ? `${acima} de ${comValor.length} meses acima da meta` : undefined}>
      {dados.length ? (
        <>
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={dados} margin={{ top: 26, right: 8, left: -14, bottom: 0 }}>
                <defs><Grad id="rt-ok" color={c.ok} /><Grad id="rt-bad" color={c.bad} /></defs>
                <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="3 5" />
                <XAxis dataKey="nome" tick={axis} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={axis} axisLine={false} tickLine={false} domain={[0, teto]} allowDataOverflow allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: c.cursor, radius: 8 }}
                  content={(p: any) => (
                    <ChartTip
                      active={p.active}
                      label={p.label}
                      payload={p.payload?.map((x: any) => ({ ...x, value: x.payload.v ?? NaN, name: `${titulo}${x.payload.origem === "importada" ? " (planilha)" : ""}` }))}
                      fmt={(v) => (Number.isFinite(v) ? fmtNum(v, dec) : "sem dados")}
                    />
                  )}
                />
                <ReferenceLine y={m} stroke={c.text} strokeDasharray="4 4" ifOverflow="visible" label={{ value: `Meta ${fmtNum(m, m % 1 ? 2 : 0)}`, position: "insideTopRight", fontSize: 11, fontWeight: 600, fill: c.text }} />
                <Bar dataKey="plot" name={titulo} maxBarSize={38} minPointSize={2} radius={[8, 8, 0, 0]}>
                  {dados.map((r, i) => (
                    <Cell key={i} fill={r.v == null ? "transparent" : `url(#rt-${r.v > r.meta ? "bad" : "ok"})`} />
                  ))}
                  <LabelList dataKey="plot" content={rotulo} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {corta && <p className="axis-note">Eixo ajustado até {fmtNum(teto, 0)} para destacar as taxas baixas; barras com ▲ passam do limite (valor real no rótulo).</p>}
        </>
      ) : (
        <Empty />
      )}
    </Card>
  );
}

function Calculo({ acumulado }: { acumulado: boolean }) {
  const { data, setExposicao, setConfig } = useData();
  const { admin } = useAuth();
  const { anosTaxas } = useFiltros();
  const hoje = new Date();
  const anos = useMemo(() => [...new Set([...anosTaxas, hoje.getFullYear()])].sort(), [anosTaxas]);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [padrao, setPadrao] = useState("");
  const [toast, setToast] = useState("");
  const cfg = data.config;

  const ate = ano === hoje.getFullYear() ? hoje.getMonth() + 1 : 12;
  const linhas = useMemo(() => Array.from({ length: 12 }, (_, i) => contarMes(data.registros, data, cfg, ano, i + 1)), [data, cfg, ano]);
  const serie = useMemo(() => serieTaxas(data, ano, acumulado), [data, ano, acumulado]);
  const semDias = linhas.reduce((s, l) => s + l.semDias, 0);
  const trajeto = linhas.reduce((s, l) => s + l.trajetoFora, 0);
  const totais = somar(linhas.slice(0, ate));
  const tAno = taxasDe(totais);

  async function salvarHoras(mes: number, valor: string) {
    const h = Number(valor.replace(",", "."));
    if (valor.trim() !== "" && (!Number.isFinite(h) || h < 0)) return setToast("Informe um número válido de horas");
    const atual = linhas[mes - 1].horas;
    if ((valor.trim() === "" ? 0 : h) === atual) return;
    const e = await setExposicao(ano, mes, valor.trim() === "" ? 0 : h);
    if (e) setToast(e);
  }

  async function preencher() {
    const h = Number(padrao.replace(",", "."));
    if (!(h > 0)) return setToast("Informe as horas-homem mensais");
    for (let m = 1; m <= ate; m++) if (!linhas[m - 1].horas) await setExposicao(ano, m, h);
    setToast("Meses sem horas preenchidos");
  }

  const alterarCfg = async (parte: Partial<typeof cfg>) => {
    const e = await setConfig({ ...cfg, ...parte });
    if (e) setToast(e);
  };
  const toggleTipo = (t: string) =>
    alterarCfg({ tiposSemAfastamento: cfg.tiposSemAfastamento.includes(t) ? cfg.tiposSemAfastamento.filter((x) => x !== t) : [...cfg.tiposSemAfastamento, t] });

  const f = (v: number | null, d = 2) => (v == null ? "—" : fmtNum(v, d));

  return (
    <>
      <Card title="Cálculo das taxas" extra="ABNT NBR 14280" className="s12">
        <div className="calc-top">
          <Chips options={anos} selected={[ano]} onToggle={(a) => setAno(a)} />
          <span className="hint-inline">{acumulado ? "Taxas acumuladas do início do ano até o mês" : "Taxas apenas do mês"}</span>
        </div>

        {(semDias > 0 || trajeto > 0) && (
          <div className="note" role="status">
            <TriangleAlert size={16} style={{ flex: "none", marginTop: 1 }} />
            <span>
              {semDias > 0 && <>Há {semDias} acidente(s) com afastamento sem <b>dias perdidos</b> informados em {ano}: a taxa de gravidade fica subestimada até o preenchimento (edite em Registros). </>}
              {trajeto > 0 && <>{trajeto} acidente(s) de trajeto ficaram fora do cálculo.</>}
            </span>
          </div>
        )}

        <div className="table-wrap">
          <table className="calc">
            <thead>
              <tr>
                <th>Mês</th>
                <th className="num">Horas-homem (H)</th>
                <th className="num" title="Acidentes com afastamento (inclui fatais)">N c/ afast.</th>
                <th className="num" title="Acidentes com lesão sem afastamento">N s/ afast.</th>
                <th className="num">Dias perdidos</th>
                <th className="num">Dias debitados</th>
                <th className="num">TFCA</th>
                <th className="num">TF</th>
                <th className="num">TG</th>
                <th>Origem</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => {
                const s = serie[i];
                const futuro = i + 1 > ate;
                return (
                  <tr key={l.mes} style={{ opacity: futuro ? 0.45 : 1 }}>
                    <td>{MESES[i]}</td>
                    <td className="num">
                      {admin ? (
                        <input
                          key={`${ano}-${l.mes}-${l.horas}`}
                          className="input h-input"
                          type="text"
                          inputMode="decimal"
                          defaultValue={l.horas ? String(l.horas) : ""}
                          placeholder="0"
                          aria-label={`Horas-homem de ${MESES[i]}/${ano}`}
                          onBlur={(e) => salvarHoras(l.mes, e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                        />
                      ) : l.horas ? fmtNum(l.horas, 0) : "—"}
                    </td>
                    <td className="num">{l.nCom}</td>
                    <td className="num">{l.nSem}</td>
                    <td className="num">{l.diasPerdidos}</td>
                    <td className="num">{l.diasDebitados}</td>
                    <td className="num"><b>{f(s.tfca)}</b></td>
                    <td className="num"><b>{f(s.tf)}</b></td>
                    <td className="num"><b>{f(s.tg, 0)}</b></td>
                    <td><span className={`origem ${s.origem.replace(" ", "-")}`}>{s.origem}</span></td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>Ano até {MESES[ate - 1]}</td>
                <td className="num">{totais.horas ? fmtNum(totais.horas, 0) : "—"}</td>
                <td className="num">{totais.nCom}</td>
                <td className="num">{totais.nSem}</td>
                <td className="num">{linhas.slice(0, ate).reduce((s, l) => s + l.diasPerdidos, 0)}</td>
                <td className="num">{linhas.slice(0, ate).reduce((s, l) => s + l.diasDebitados, 0)}</td>
                <td className="num">{f(tAno.tfca)}</td>
                <td className="num">{f(tAno.tf)}</td>
                <td className="num">{f(tAno.tg, 0)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="hint-inline" style={{ marginTop: 10 }}>
          Linha de totais: calculada só com os meses que têm horas-homem informadas. Meses sem horas usam, no modo acumulado, a taxa importada da planilha.
        </p>

        {admin && (
          <div className="calc-fill">
            <input className="input" style={{ maxWidth: 220 }} inputMode="decimal" placeholder="Horas-homem por mês" value={padrao} onChange={(e) => setPadrao(e.target.value)} aria-label="Horas-homem mensais padrão" />
            <button className="btn" onClick={preencher}><Calculator size={15} /> Preencher meses sem horas</button>
          </div>
        )}
      </Card>

      <Card title="Critérios e metas" className="s6">
        <div className="crit">
          <div className="field">
            <label>Meta TF (frequência)</label>
            <input className="input" inputMode="decimal" disabled={!admin} defaultValue={cfg.metaTf} key={`mtf${cfg.metaTf}`} onBlur={(e) => { const n = Number(e.target.value.replace(",", ".")); if (n > 0 && n !== cfg.metaTf) alterarCfg({ metaTf: n }); }} />
          </div>
          <div className="field">
            <label>Meta TG (gravidade)</label>
            <input className="input" inputMode="decimal" disabled={!admin} defaultValue={cfg.metaTg} key={`mtg${cfg.metaTg}`} onBlur={(e) => { const n = Number(e.target.value.replace(",", ".")); if (n > 0 && n !== cfg.metaTg) alterarCfg({ metaTg: n }); }} />
          </div>
        </div>
        <div className="field" style={{ marginTop: 14 }}>
          <label>Tipos que entram na TF (lesão sem afastamento)</label>
          <div className="chips">
            {TIPOS.filter((t) => t !== "INCIDENTE").map((t) => (
              <button key={t} className={`chip ${cfg.tiposSemAfastamento.includes(t) ? "on" : ""}`} disabled={!admin} onClick={() => toggleTipo(t)} aria-pressed={cfg.tiposSemAfastamento.includes(t)}>{t}</button>
            ))}
          </div>
        </div>
        <label className="check">
          <input type="checkbox" disabled={!admin} checked={cfg.incluirTrajeto} onChange={(e) => alterarCfg({ incluirTrajeto: e.target.checked })} />
          Incluir acidentes de trajeto no cálculo
        </label>
        {!admin && <p className="hint-inline">Somente administradores alteram critérios e horas-homem.</p>}
      </Card>

      <Card title="Como as taxas são calculadas" className="s6">
        <ul className="formulas">
          <li><b>TFCA</b> (frequência com afastamento) = N com afastamento × 1.000.000 ÷ H</li>
          <li><b>TF</b> (frequência sem afastamento) = N sem afastamento × 1.000.000 ÷ H</li>
          <li><b>TG</b> (gravidade) = (dias perdidos + dias debitados) × 1.000.000 ÷ H</li>
        </ul>
        <ul className="formulas leve">
          <li><b>H</b>: horas-homem de exposição ao risco no período, incluindo horas extras e excluindo férias, licenças e faltas.</li>
          <li><b>Dias perdidos</b>: dias corridos de afastamento, sem contar o dia do acidente nem o da volta.</li>
          <li><b>Dias debitados</b>: 6.000 dias para morte ou incapacidade total permanente; perdas parciais seguem a tabela da norma (informe no registro).</li>
          <li>Fatais entram em N com afastamento. Acidentes de trajeto ficam de fora, salvo se marcado ao lado.</li>
          <li>Acumulado = soma de N, dias e H do início do ano até o mês.</li>
        </ul>
      </Card>
      {toast && <Toast msg={toast} onDone={() => setToast("")} />}
    </>
  );
}

export default function Rates() {
  const { data } = useData();
  const { anosTaxas } = useFiltros();
  const [anosSel, setAnosSel] = useState<number[]>([]);
  const [mesesSel, setMesesSel] = useState<number[]>([]);
  const iniciou = useRef(false);
  useEffect(() => {
    if (iniciou.current || !anosTaxas.length) return;
    iniciou.current = true;
    setAnosSel([anosTaxas[anosTaxas.length - 1]]);
  }, [anosTaxas]);
  const [completo, setCompleto] = useState(false);
  const [acumulado, setAcumulado] = useState(true);

  const rows = useMemo(() => {
    const hoje = new Date();
    const anos = anosSel.length ? anosSel : anosTaxas;
    return anos
      .flatMap((a) => serieTaxas(data, a, acumulado))
      .filter((t) => (!mesesSel.length || mesesSel.includes(t.mes)) && (t.ano < hoje.getFullYear() || (t.ano === hoje.getFullYear() && t.mes <= hoje.getMonth() + 1)))
      .sort((a, b) => a.ano - b.ano || a.mes - b.mes);
  }, [data, anosSel, mesesSel, anosTaxas, acumulado]);
  const alterna = <T,>(lista: T[], v: T) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

  return (
    <>
      <div className="note">
        As taxas são do grupo todo: valem os filtros de ano e mês desta página; base e gerência não se aplicam. Sem seleção, mostra todos os anos e meses. Meses futuros ficam ocultos.
      </div>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 14 }}>
        <div className="fgroup">
          <span>Ano</span>
          <Chips options={anosTaxas} selected={anosSel} onToggle={(a) => setAnosSel(alterna(anosSel, a))} />
        </div>
        <div className="fgroup">
          <span>Mês</span>
          <Chips options={MESES.map((_, i) => i + 1)} selected={mesesSel} onToggle={(m) => setMesesSel(alterna(mesesSel, m))} label={(m) => MESES[m - 1]} />
        </div>
        {(anosSel.length > 0 || mesesSel.length > 0) && <button className="btn" onClick={() => { setAnosSel([]); setMesesSel([]); }}>Limpar</button>}
      </div>
      <div className="topbar" style={{ marginBottom: 14, gap: 10 }}>
        <div className="seg" role="group" aria-label="Período da taxa">
          <button className={acumulado ? "on" : ""} onClick={() => setAcumulado(true)}>Acumulado no ano</button>
          <button className={!acumulado ? "on" : ""} onClick={() => setAcumulado(false)}>Mensal</button>
        </div>
        <div className="seg" role="group" aria-label="Escala do eixo">
          <button className={!completo ? "on" : ""} onClick={() => setCompleto(false)}>Eixo ajustado</button>
          <button className={completo ? "on" : ""} onClick={() => setCompleto(true)}>Eixo completo</button>
        </div>
      </div>
      <div className="grid">
        <div className="s12"><RateChart rows={rows} campo="tfca" titulo="Taxa de frequência com afastamento (TFCA)" completo={completo} /></div>
        <div className="s12"><RateChart rows={rows} campo="tf" titulo="Taxa de frequência sem afastamento (TF)" completo={completo} /></div>
        <div className="s12"><RateChart rows={rows} campo="tg" titulo="Taxa de gravidade (TG)" completo={completo} /></div>
        <Calculo acumulado={acumulado} />
      </div>
    </>
  );
}
