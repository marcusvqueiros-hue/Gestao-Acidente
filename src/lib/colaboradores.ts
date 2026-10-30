import type * as XLSXNS from "xlsx";
import type { Colaborador } from "../types";

const GERENCIAS_POR_NOME: Record<string, string> = { ALMOXARIFE: "ALMOX", ALMOXARIFADO: "ALMOX", LOGISTICA: "LOG", "LOGÍSTICA": "LOG" };

const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const limpa = (v: unknown) => (v == null ? "" : String(v).replace(/\s+/g, " ").trim());

/** Nome comparável: sem acento, maiúsculas e espaços únicos. */
export const normNome = (n: string) => semAcento(n).toUpperCase().replace(/\s+/g, " ").trim();

let porNome = new Map<string, Colaborador>();
export const definirColaboradores = (lista: Colaborador[]) => {
  porNome = new Map(lista.map((c) => [normNome(c.nome), c]));
};
export const colaboradorDe = (nome: string) => porNome.get(normNome(nome));

/** Lê a aba "Base" da planilha do QSMS (CHAPA, NOME, FUNÇÃO, BASE, PROCESSO, GERENCIA, SITUAÇÃO). */
export function parseColaboradores(X: typeof XLSXNS, wb: XLSXNS.WorkBook): Colaborador[] {
  const ws = wb.Sheets["Base"] ?? wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const linhas = X.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
  const campo = (o: Record<string, unknown>, nome: string) => {
    const k = Object.keys(o).find((c) => semAcento(c).trim().toUpperCase() === nome);
    return k ? limpa(o[k]) : "";
  };
  const porChapa = new Map<string, Colaborador>();
  for (const o of linhas) {
    const chapa = campo(o, "CHAPA");
    const nome = campo(o, "NOME");
    if (!chapa || !nome) continue;
    const ger = campo(o, "GERENCIA").toUpperCase();
    porChapa.set(chapa, {
      chapa,
      nome: nome.toUpperCase(),
      funcao: campo(o, "FUNCAO").toUpperCase(),
      base: campo(o, "BASE").toUpperCase(),
      processo: campo(o, "PROCESSO"),
      gerencia: GERENCIAS_POR_NOME[ger] ?? ger,
      situacao: campo(o, "SITUACAO").toUpperCase(),
    });
  }
  return [...porChapa.values()];
}
