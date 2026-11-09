import type { NdgsMes } from "../types";

/** Índices que compõem o NDGS, com o peso de cada um (planilha "Conceito"). */
export const INDICES = [
  { id: "icad", nome: "ICAD", descricao: "Índice de Conformidade da Auditoria Documental", peso: 0.2, verificacao: "Semestral" },
  { id: "icit", nome: "ICIT", descricao: "Índice de Conformidade de Inspeções em Turmas", peso: 0.2, verificacao: "Mensal" },
  { id: "icia", nome: "ICIA", descricao: "Índice de Conformidade de Inspeções em Alojamentos", peso: 0.1, verificacao: "Mensal" },
  { id: "tfa", nome: "TFA", descricao: "Taxa de Frequência de Acidentados", peso: 0.15, verificacao: "Mensal" },
  { id: "tga", nome: "TGA", descricao: "Taxa de Gravidade dos Acidentados", peso: 0.25, verificacao: "Mensal" },
  { id: "ipws", nome: "IPWS", descricao: "Índice de Participação no Workshop de Segurança", peso: 0.1, verificacao: "Mensal" },
] as const;

export type IndiceId = (typeof INDICES)[number]["id"];
export const IDS: IndiceId[] = INDICES.map((i) => i.id);

export type Situacao = "atende" | "parcial" | "nao";

/** Faixas do NDGS: Atende ≥ 90, Atende parcial entre 70 e 90, Não atende < 70. */
export const situacao = (v: number): Situacao => (v >= 0.9 ? "atende" : v >= 0.7 ? "parcial" : "nao");
export const ROTULO_SITUACAO: Record<Situacao, string> = { atende: "Atende", parcial: "Atende parcial", nao: "Não atende" };
export const COR_SITUACAO: Record<Situacao, string> = { atende: "#22b45f", parcial: "#f2c200", nao: "#d9485f" };

/** NDGS = ICAD × 0,20 + ICIT × 0,20 + ICIA × 0,10 + TFA × 0,15 + TGA × 0,25 + IPWS × 0,10 (só com os seis índices informados). */
export function calcularNdgs(m: Partial<Record<IndiceId, number | null>>): number | null {
  let soma = 0;
  for (const i of INDICES) {
    const v = m[i.id];
    if (v == null || !Number.isFinite(v)) return null;
    soma += v * i.peso;
  }
  return soma;
}

/** Valor oficial do mês: o informado manualmente (coluna VALOR da planilha) ou, na falta dele, o calculado. */
export const ndgsDe = (m: NdgsMes): number | null => (m.valor != null && Number.isFinite(m.valor) ? m.valor : calcularNdgs(m));

export type SerieId = "ndgs" | IndiceId;
export const valorDe = (m: NdgsMes, id: SerieId): number | null => (id === "ndgs" ? ndgsDe(m) : (m[id] ?? null));

export function media(lista: NdgsMes[], id: SerieId): number | null {
  const v = lista.map((m) => valorDe(m, id)).filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export const pct = (v: number | null, d = 2) =>
  v == null ? "—" : `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: d })}%`;

/** Converte "93", "93,5" ou "93%" (percentual) em fração (0–1); vazio vira null; NaN indica texto inválido. */
export function lerPercentual(t: string): number | null {
  const s = t.trim().replace("%", "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return n / 100;
}
