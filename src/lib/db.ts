import type { ConfigTaxas, Dataset, Equipe, Exposicao, Registro, Taxa } from "../types";
import { CONFIG_PADRAO } from "../types";
import { supabase } from "./supabase";

type Linha = Record<string, any>;

const db = () => {
  if (!supabase) throw new Error("Banco não configurado");
  return supabase;
};

export const paraLinha = (r: Registro): Linha => ({
  id: r.id,
  categoria: r.categoria,
  data: r.data,
  hora: r.hora || null,
  turno: r.turno ?? "",
  colaborador: r.colaborador ?? "",
  prefixo: r.prefixo ?? "",
  processo: r.processo ?? "",
  base: r.base ?? "",
  cidade: r.cidade ?? "",
  supervisor: r.supervisor ?? "",
  tipo: r.tipo ?? "",
  caracteristica: r.caracteristica ?? "",
  definicao: r.definicao ?? "",
  descricao: r.descricao ?? "",
  envolvidos: r.envolvidos,
  gravidade: r.gravidade ?? "",
  lesao: r.lesao ?? "",
  cat: r.cat ?? "",
  trajeto: r.trajeto ?? "",
  comunicado_eqtl: r.comunicadoEqtl ?? "",
  dias_perdidos: r.diasPerdidos ?? null,
  // só envia quando preenchido: assim funciona mesmo antes de a coluna existir no banco
  ...(r.diasDebitados != null ? { dias_debitados: r.diasDebitados } : {}),
  acoes: r.acoes ?? [],
});

export const deLinha = (l: Linha): Registro => ({
  id: l.id,
  categoria: l.categoria,
  data: String(l.data).slice(0, 10),
  hora: l.hora ?? undefined,
  turno: l.turno ?? "",
  colaborador: l.colaborador ?? "",
  prefixo: l.prefixo ?? "",
  processo: l.processo ?? "",
  base: l.base ?? "",
  cidade: l.cidade ?? "",
  supervisor: l.supervisor ?? "",
  tipo: l.tipo ?? "",
  caracteristica: l.caracteristica ?? "",
  definicao: l.definicao ?? "",
  descricao: l.descricao ?? "",
  envolvidos: l.envolvidos === "TERCEIROS" ? "TERCEIROS" : "PRÓPRIOS",
  gravidade: l.gravidade ?? "",
  lesao: l.lesao ?? "",
  cat: l.cat ?? "",
  trajeto: l.trajeto ?? "",
  comunicadoEqtl: l.comunicado_eqtl ?? "",
  diasPerdidos: l.dias_perdidos ?? undefined,
  diasDebitados: l.dias_debitados ?? undefined,
  acoes: l.acoes ?? [],
});

const taxaParaLinha = (t: Taxa): Linha => ({ ano: t.ano, mes: t.mes, tg: t.tg, meta_tg: t.metaTg, tf: t.tf, tfca: t.tfca, meta_tf: t.metaTf });
const taxaDeLinha = (l: Linha): Taxa => ({ ano: l.ano, mes: l.mes, tg: l.tg, metaTg: l.meta_tg, tf: l.tf, tfca: l.tfca, metaTf: l.meta_tf });

const mensagem = (e: { message?: string } | null) => (e ? e.message || "Falha ao acessar o banco" : null);

async function todas(tabela: string, ordem: string[]): Promise<Linha[]> {
  const saida: Linha[] = [];
  for (let de = 0; ; de += 1000) {
    let q = db().from(tabela).select("*");
    for (const o of ordem) q = q.order(o);
    const { data, error } = await q.range(de, de + 999);
    if (error) throw error;
    saida.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return saida;
}

/** Tabelas criadas numa etapa posterior: se ainda não existirem, o app segue com valores padrão. */
async function opcional(tabela: string, ordem: string[]): Promise<Linha[]> {
  try {
    return await todas(tabela, ordem);
  } catch {
    return [];
  }
}

export async function carregarDataset(): Promise<Dataset> {
  const [regs, taxas, expo, conf, eq] = await Promise.all([
    todas("registros", ["data", "id"]),
    todas("taxas", ["ano", "mes"]),
    opcional("exposicao", ["ano", "mes"]),
    opcional("configuracao", ["chave"]),
    opcional("equipes", ["prefixo"]),
  ]);
  const cfg = conf.find((c) => c.chave === "taxas")?.valor as Partial<ConfigTaxas> | undefined;
  const marcas = [...regs, ...taxas].map((l) => l.atualizado_em as string).filter(Boolean);
  return {
    registros: regs.map(deLinha),
    taxas: taxas.map(taxaDeLinha),
    equipes: eq.map((e) => ({ prefixo: e.prefixo, base: e.base ?? "", gerencia: e.gerencia ?? "", coordenador: e.coordenador ?? "", gerente: e.gerente ?? "" })),
    exposicao: expo.map((e) => ({ ano: e.ano, mes: e.mes, horas: Number(e.horas) })),
    config: { ...CONFIG_PADRAO, ...(cfg ?? {}) },
    atualizadoEm: marcas.length ? marcas.reduce((a, b) => (a > b ? a : b)) : new Date().toISOString(),
  };
}

export async function gravarRegistro(r: Registro): Promise<string | null> {
  const { error } = await db().from("registros").upsert(paraLinha(r));
  return mensagem(error);
}

export async function apagarRegistro(id: string): Promise<string | null> {
  const { error } = await db().from("registros").delete().eq("id", id);
  return mensagem(error);
}

export async function gravarTaxa(t: Taxa): Promise<string | null> {
  const { error } = await db().from("taxas").upsert(taxaParaLinha(t));
  return mensagem(error);
}

/** Substitui todo o conteúdo (usado ao importar a planilha). Não é atômico: se falhar no meio, importe de novo. */
export async function substituirTudo(d: Dataset): Promise<string | null> {
  const c = db();
  let r = await c.from("registros").delete().neq("id", "");
  if (r.error) return mensagem(r.error);
  for (let i = 0; i < d.registros.length; i += 300) {
    r = await c.from("registros").insert(d.registros.slice(i, i + 300).map(paraLinha));
    if (r.error) return mensagem(r.error);
  }
  if (d.taxas.length) {
    r = await c.from("taxas").delete().gte("ano", 0);
    if (r.error) return mensagem(r.error);
    r = await c.from("taxas").insert(d.taxas.map(taxaParaLinha));
    if (r.error) return mensagem(r.error);
  }
  return null;
}

export async function gravarExposicao(e: Exposicao): Promise<string | null> {
  const c = db();
  if (!(e.horas > 0)) {
    const { error } = await c.from("exposicao").delete().eq("ano", e.ano).eq("mes", e.mes);
    return mensagem(error);
  }
  const { error } = await c.from("exposicao").upsert({ ano: e.ano, mes: e.mes, horas: e.horas });
  return mensagem(error);
}

export async function gravarConfig(cfg: ConfigTaxas): Promise<string | null> {
  const { error } = await db().from("configuracao").upsert({ chave: "taxas", valor: cfg });
  return mensagem(error);
}

/** Substitui o cadastro de equipes inteiro (importação da planilha). */
export async function gravarEquipes(lista: Equipe[]): Promise<string | null> {
  const c = db();
  const r = await c.from("equipes").delete().neq("prefixo", "");
  if (r.error) return mensagem(r.error);
  for (let i = 0; i < lista.length; i += 300) {
    const { error } = await c.from("equipes").insert(lista.slice(i, i + 300));
    if (error) return mensagem(error);
  }
  return null;
}
