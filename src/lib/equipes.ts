import type * as XLSXNS from "xlsx";
import type { Equipe, Registro } from "../types";

/** Prefixo comparável: maiúsculas, sem espaços nas pontas nem ponto final (ex.: "MA-PDS-P004M." → "MA-PDS-P004M"). */
export const normPrefixo = (p: string) => p.trim().toUpperCase().replace(/\.+$/, "");

const BASES_POR_NOME: Record<string, string> = {
  BACABAL: "BCB",
  "BARRA DO CORDA": "BDC",
  PEDREIRAS: "PDS",
  "PRESIDENTE DUTRA": "PDT",
  "ITAPECURU MIRIM": "ITM",
  "SANTA INES": "STI",
};
const GERENCIAS_POR_NOME: Record<string, string> = { LOGISTICA: "LOG", OFICINA: "FROTA", ALMOXARIFADO: "ALMOX" };

const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const limpa = (v: unknown) => (v == null ? "" : String(v).replace(/\s+/g, " ").trim());

/* ---- cadastro em memória: consultado pelos filtros e gráficos (que não têm acesso ao contexto de dados) ---- */
let porPrefixo = new Map<string, Equipe>();
let gerentePorBase = new Map<string, string>();

export function definirEquipes(lista: Equipe[]) {
  porPrefixo = new Map(lista.map((e) => [normPrefixo(e.prefixo), e]));
  // gerente de cada base = o mais frequente entre as equipes da base (usado quando o prefixo não está no cadastro)
  const cont = new Map<string, Map<string, number>>();
  for (const e of lista) {
    if (!e.base || !e.gerente) continue;
    const m = cont.get(e.base) ?? new Map<string, number>();
    m.set(e.gerente, (m.get(e.gerente) ?? 0) + 1);
    cont.set(e.base, m);
  }
  gerentePorBase = new Map([...cont].map(([b, m]) => [b, [...m].sort((a, c) => c[1] - a[1])[0][0]]));
}

export const equipeDe = (prefixo: string) => porPrefixo.get(normPrefixo(prefixo));

export const SEM_GERENTE = "Sem gerente definido";
export const gerenteDe = (r: Pick<Registro, "prefixo" | "base">) => equipeDe(r.prefixo)?.gerente || gerentePorBase.get(r.base) || SEM_GERENTE;
export const listaGerentes = () => [...new Set(gerentePorBase.values())].sort();
export const listaCoordenadoresEquipes = () => [...new Set([...porPrefixo.values()].map((e) => e.coordenador).filter(Boolean))];

/** Lê a planilha de equipes (colunas: Prefixo, Base, Gerência, Coordenador, Gerente). Primeira aba. */
export function parseEquipes(X: typeof XLSXNS, wb: XLSXNS.WorkBook, coordenadoresConhecidos: string[]): Equipe[] {
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const linhas = X.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
  const campo = (o: Record<string, unknown>, nome: string) => {
    const k = Object.keys(o).find((c) => semAcento(c).trim().toUpperCase() === nome);
    return k ? limpa(o[k]) : "";
  };
  // "Antonio M" e "Antonio M." são a mesma pessoa: adota a grafia já usada na regra de coordenação
  const nome = (n: string) => coordenadoresConhecidos.find((c) => c.replace(/\.$/, "").toLowerCase() === n.replace(/\.$/, "").toLowerCase()) ?? n;
  const vistos = new Map<string, Equipe>();
  for (const o of linhas) {
    const prefixo = normPrefixo(campo(o, "PREFIXO"));
    if (!prefixo) continue;
    const base = campo(o, "BASE").toUpperCase();
    const ger = campo(o, "GERENCIA").toUpperCase();
    vistos.set(prefixo, {
      prefixo,
      base: BASES_POR_NOME[semAcento(base)] ?? base,
      gerencia: GERENCIAS_POR_NOME[ger] ?? ger,
      coordenador: nome(campo(o, "COORDENADOR")),
      gerente: campo(o, "GERENTE"),
    });
  }
  return [...vistos.values()];
}
