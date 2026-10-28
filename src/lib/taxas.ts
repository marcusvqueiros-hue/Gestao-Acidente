import type { ConfigTaxas, Dataset, Registro } from "../types";

/**
 * Cálculo das taxas conforme a ABNT NBR 14280 (cadastro de acidente do trabalho):
 *   TFCA = N com afastamento × 10⁶ / H
 *   TF   = N sem afastamento × 10⁶ / H
 *   TG   = (dias perdidos + dias debitados) × 10⁶ / H
 * H = horas-homem de exposição ao risco no período.
 */
export const BASE = 1_000_000;
export const DIAS_DEBITADOS_MORTE = 6000;

export type Origem = "calculada" | "importada" | "sem dados";

export interface TaxaMes {
  ano: number;
  mes: number;
  tf: number | null;
  tfca: number | null;
  tg: number | null;
  origem: Origem;
  metaTf: number;
  metaTg: number;
}

export interface Contagem {
  ano: number;
  mes: number;
  horas: number; // H do mês (0 = não informado)
  nCom: number;
  nSem: number;
  diasPerdidos: number;
  diasDebitados: number;
  trajetoFora: number; // acidentes de trajeto desconsiderados
  semDias: number; // acidentes com afastamento sem dias perdidos informados
}

const eTrajeto = (r: Registro) => r.trajeto === "SIM" || r.caracteristica.includes("TRAJETO");
export const comAfastamento = (r: Registro) => r.lesao === "COM AFASTAMENTO" || r.lesao === "FATAL";

/** Dias debitados do registro: informado ou, se fatal e vazio, 6.000 (morte). */
export const debitadosDe = (r: Registro) => r.diasDebitados ?? (r.lesao === "FATAL" ? DIAS_DEBITADOS_MORTE : 0);

export function contarMes(regs: Registro[], d: Pick<Dataset, "exposicao">, cfg: ConfigTaxas, ano: number, mes: number): Contagem {
  const doMes = regs.filter((r) => r.categoria === "acidente" && Number(r.data.slice(0, 4)) === ano && Number(r.data.slice(5, 7)) === mes);
  const considerados = doMes.filter((r) => cfg.incluirTrajeto || !eTrajeto(r));
  const com = considerados.filter(comAfastamento);
  const sem = considerados.filter((r) => r.lesao === "SEM AFASTAMENTO" && cfg.tiposSemAfastamento.includes(r.tipo));
  return {
    ano,
    mes,
    horas: d.exposicao.find((e) => e.ano === ano && e.mes === mes)?.horas ?? 0,
    nCom: com.length,
    nSem: sem.length,
    diasPerdidos: com.reduce((s, r) => s + (r.diasPerdidos ?? 0), 0),
    diasDebitados: com.reduce((s, r) => s + debitadosDe(r), 0),
    trajetoFora: cfg.incluirTrajeto ? 0 : doMes.filter((r) => eTrajeto(r) && (comAfastamento(r) || (r.lesao === "SEM AFASTAMENTO" && cfg.tiposSemAfastamento.includes(r.tipo)))).length,
    semDias: com.filter((r) => r.diasPerdidos == null && r.lesao !== "FATAL").length,
  };
}

const razao = (n: number, h: number) => (h > 0 ? (n * BASE) / h : null);

/** Soma de contagens (para o acumulado do ano). */
export function somar(cs: Contagem[]) {
  return cs.reduce(
    (a, c) => ({ horas: a.horas + c.horas, nCom: a.nCom + c.nCom, nSem: a.nSem + c.nSem, tempo: a.tempo + c.diasPerdidos + c.diasDebitados }),
    { horas: 0, nCom: 0, nSem: 0, tempo: 0 },
  );
}

export const taxasDe = (s: { horas: number; nCom: number; nSem: number; tempo: number }) => ({
  tfca: razao(s.nCom, s.horas),
  tf: razao(s.nSem, s.horas),
  tg: razao(s.tempo, s.horas),
});

/**
 * Série mensal de taxas. `acumulado` = do início do ano até o mês (padrão da empresa e da planilha).
 * Sem horas-homem suficientes, usa a taxa importada da planilha (só no acumulado, pois ela é acumulada).
 */
export function serieTaxas(d: Dataset, ano: number, acumulado: boolean): TaxaMes[] {
  const meta = (mes: number) => {
    const imp = d.taxas.find((t) => t.ano === ano && t.mes === mes);
    return { metaTf: imp?.metaTf || d.config.metaTf, metaTg: imp?.metaTg || d.config.metaTg };
  };
  const contagens = Array.from({ length: 12 }, (_, i) => contarMes(d.registros, d, d.config, ano, i + 1));
  return contagens.map((c, i) => {
    const m = i + 1;
    const janela = acumulado ? contagens.slice(0, m) : [c];
    const completo = janela.every((x) => x.horas > 0);
    if (completo) {
      const t = taxasDe(somar(janela));
      return { ano, mes: m, ...t, origem: "calculada" as const, ...meta(m) };
    }
    const imp = d.taxas.find((t) => t.ano === ano && t.mes === m);
    if (acumulado && imp) return { ano, mes: m, tf: imp.tf, tfca: imp.tfca, tg: imp.tg, origem: "importada" as const, ...meta(m) };
    return { ano, mes: m, tf: null, tfca: null, tg: null, origem: "sem dados" as const, ...meta(m) };
  });
}
