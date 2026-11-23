import type { AcaoPlano, Registro, SituacaoAcao } from "../types";
import { normNome } from "./colaboradores";

export const SITUACOES: SituacaoAcao[] = ["CONCLUIDO", "EM ANDAMENTO", "PENDENTE", "ATRASADO"];
export const ROTULO_SIT: Record<SituacaoAcao, string> = { CONCLUIDO: "Concluído", "EM ANDAMENTO": "Em andamento", PENDENTE: "Pendente", ATRASADO: "Atrasado" };
export const COR_SIT: Record<SituacaoAcao, string> = { CONCLUIDO: "#22b45f", "EM ANDAMENTO": "#f2c200", PENDENTE: "#8a929b", ATRASADO: "#d9485f" };

/** Campos que precisam estar preenchidos para a ação entrar no plano de ação dos sinistros. */
export const CAMPOS_OBRIGATORIOS: { id: "nome" | "area" | "acao" | "base" | "responsavel" | "prazo"; rotulo: string }[] = [
  { id: "nome", rotulo: "Nome" },
  { id: "area", rotulo: "Áreas de controle" },
  { id: "acao", rotulo: "Ação de melhoria" },
  { id: "base", rotulo: "Base" },
  { id: "responsavel", rotulo: "Responsável pela execução" },
  { id: "prazo", rotulo: "Prazo de conclusão" },
];

export const faltando = (a: AcaoPlano): string[] => CAMPOS_OBRIGATORIOS.filter((c) => !String(a[c.id] ?? "").trim()).map((c) => c.rotulo);
export const completa = (a: AcaoPlano) => faltando(a).length === 0;

export const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Situação que vale para o relatório: o que não está concluído e passou do prazo é atrasado. */
export function situacaoEfetiva(a: AcaoPlano, hoje = hojeISO()): SituacaoAcao {
  if (a.situacao === "CONCLUIDO") return "CONCLUIDO";
  if (a.prazo && a.prazo < hoje) return "ATRASADO";
  return a.situacao === "ATRASADO" && !a.prazo ? "ATRASADO" : a.situacao === "ATRASADO" ? "EM ANDAMENTO" : a.situacao;
}

const espacos = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();

/** Chave para reconhecer a mesma ação ao importar de novo (data + colaborador + texto da ação). */
export const chaveAcao = (a: Pick<AcaoPlano, "dataEvento" | "nome" | "acao">) => `${a.dataEvento}|${normNome(a.nome)}|${normNome(a.acao)}`;

export const novoIdAcao = () => "pa-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** Nomes "iguais" para ligar a ação ao sinistro: iguais, um dentro do outro ou ao menos dois nomes em comum. */
function nomesBatem(a: string, b: string) {
  const x = normNome(a), y = normNome(b);
  if (!x || !y) return false;
  if (x === y || x.includes(y) || y.includes(x)) return true;
  const tx = new Set(x.split(" ").filter((t) => t.length > 2));
  return y.split(" ").filter((t) => t.length > 2 && tx.has(t)).length >= 2;
}

/** Sinistro de cada ação: o informado ou o de mesma data e colaborador. */
export function sinistroDa(a: AcaoPlano, sinistros: Registro[]): Registro | undefined {
  if (a.registroId) {
    const r = sinistros.find((s) => s.id === a.registroId);
    if (r) return r;
  }
  return sinistros.find((s) => s.data === a.dataEvento && nomesBatem(s.colaborador, a.nome));
}

/* ---------- leitura da planilha "Plano de Ação" ---------- */
const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");
const chave = (t: unknown) => sem(String(t ?? "")).toUpperCase().replace(/[^A-Z0-9]/g, "");
const iso = (y: number, m: number, d: number) => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

type SSF = { parse_date_code: (n: number) => { y: number; m: number; d: number } | null };

/** Aceita data do Excel, "17/07/2026", "17/072026" ou um período ("De 19/08/2026 a 31/08/2026", fica a última data). */
export function lerData(v: unknown, ssf: SSF): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    const d = ssf.parse_date_code(v);
    return d ? iso(d.y, d.m, d.d) : null;
  }
  const todas = [...String(v).matchAll(/(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]?\s*(\d{4})/g)];
  if (!todas.length) return null;
  const m = todas[todas.length - 1];
  return iso(Number(m[3]), Number(m[2]), Number(m[1]));
}

export function lerSituacao(v: unknown): SituacaoAcao {
  const t = chave(v);
  if (t.startsWith("CONCLU")) return "CONCLUIDO";
  if (t.startsWith("ATRAS")) return "ATRASADO";
  if (t.startsWith("EMAND")) return "EM ANDAMENTO";
  return "PENDENTE";
}

/** Converte a primeira aba da planilha em ações. Devolve também quantas linhas foram ignoradas. */
export function lerPlanilha(grade: unknown[][], ssf: SSF): { acoes: AcaoPlano[]; ignoradas: number } | null {
  const cab = grade.findIndex((l) => l.some((c) => chave(c).startsWith("DATADOEVENTO")));
  if (cab < 0) return null;
  const col = (prefixo: string) => grade[cab].findIndex((c) => chave(c).startsWith(prefixo));
  const i = {
    data: col("DATADOEVENTO"), nome: col("NOME"), area: col("AREAS"), acao: col("ACAO"), base: col("BASE"),
    resp: col("RESPONSAVEL"), prazo: col("DATAPREVISTA"), sit: col("SITUACAO"),
  };
  const acoes: AcaoPlano[] = [];
  let ignoradas = 0;
  grade.slice(cab + 1).forEach((l, n) => {
    if (l.every((c) => c == null || c === "")) return;
    const dataEvento = lerData(l[i.data], ssf);
    const acao = espacos(l[i.acao]);
    if (!dataEvento || !acao) {
      ignoradas++;
      return;
    }
    const situacao = lerSituacao(l[i.sit]);
    const prazo = lerData(l[i.prazo], ssf);
    acoes.push({
      id: novoIdAcao() + n,
      registroId: null,
      dataEvento,
      nome: espacos(l[i.nome]),
      area: espacos(l[i.area]),
      acao,
      base: espacos(l[i.base]).toUpperCase(),
      responsavel: espacos(l[i.resp]),
      prazo,
      situacao,
      concluidoEm: situacao === "CONCLUIDO" ? prazo : null,
    });
  });
  return { acoes, ignoradas };
}
