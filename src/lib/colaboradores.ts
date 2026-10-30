import type { Colaborador } from "../types";

const GERENCIAS_POR_NOME: Record<string, string> = { ALMOXARIFE: "ALMOX", ALMOXARIFADO: "ALMOX", LOGISTICA: "LOG", "LOGÍSTICA": "LOG" };

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const limpa = (v: unknown) => (v == null ? "" : String(v).replace(/s+/g, " ").trim());

/** Nome comparável: sem acento, maiúsculas e espaços únicos. */
export const normNome = (n: string) => semAcento(n).toUpperCase().replace(/s+/g, " ").trim();

let porNome = new Map<string, Colaborador>();
export const definirColaboradores = (lista: Colaborador[]) => {
  porNome = new Map(lista.map((c) => [normNome(c.nome), c]));
};
export const colaboradorDe = (nome: string) => porNome.get(normNome(nome));

/**
 * A tabela "colaboradores" do banco guarda cada pessoa em `dados` (JSON: id/chapa, nome, funcao, base, gerencia, processo, situacao).
 * Ela é mantida pelo cadastro do QSMS; este sistema só lê. A linha de teste (nome "TESTE") é ignorada.
 */
export function colaboradorDeLinha(linha: { id?: unknown; dados?: Record<string, unknown> | null }): Colaborador | null {
  const d = linha.dados ?? {};
  const nome = limpa(d.nome);
  const chapa = limpa(d.chapa ?? d.id ?? linha.id);
  if (!nome || nome.toUpperCase() === "TESTE") return null;
  const ger = limpa(d.gerencia).toUpperCase();
  return {
    chapa,
    nome: nome.toUpperCase(),
    funcao: limpa(d.funcao).toUpperCase(),
    base: limpa(d.base).toUpperCase(),
    processo: limpa(d.processo),
    gerencia: GERENCIAS_POR_NOME[ger] ?? ger,
    situacao: limpa(d.situacao).toUpperCase(),
  };
}
