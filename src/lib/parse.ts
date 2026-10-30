import type * as XLSXNS from "xlsx";
import type { Acao, Dataset, Registro, Taxa } from "../types";
import { CONFIG_PADRAO } from "../types";
import { DIAS } from "../types";

type X = typeof XLSXNS;

const PROCESSOS: Record<string, string> = {
  ALMOXARIFADO: "ALMOX",
  ADMINISTRATIVO: "ADM",
  LOGISTICA: "LOG",
  "LOGÍSTICA": "LOG",
};

const clean = (v: unknown) => (v == null ? "" : String(v).replace(/\s+/g, " ").trim());

export function toISODate(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  if (v instanceof Date) return new Date(v.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
  if (typeof v === "number") return new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 864e5).toISOString().slice(0, 10);
  const s = String(v).trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return undefined;
}

function toHora(v: unknown): string | undefined {
  if (typeof v === "number") {
    const mins = Math.round((v - Math.floor(v)) * 1440) % 1440;
    return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  }
  const m = typeof v === "string" ? v.match(/(\d{1,2}):(\d{2})/) : null;
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : undefined;
}

export const diaDaSemana = (iso: string) => DIAS[(new Date(iso + "T12:00:00").getDay() + 6) % 7];

export const turnoDaHora = (hora?: string) => {
  if (!hora) return "";
  const h = Number(hora.slice(0, 2));
  return h < 12 ? "MANHÃ" : h < 18 ? "TARDE" : "NOITE";
};

type Row = (string | number | Date | null)[];

function readTable(X: X, wb: XLSXNS.WorkBook, sheet: string, mustHave: string[]) {
  const ws = wb.Sheets[sheet];
  if (!ws) return [];
  const rows = X.utils.sheet_to_json<Row>(ws, { header: 1, defval: null, raw: true });
  const hi = rows.findIndex((r) => mustHave.every((h) => r.some((c) => clean(c).toUpperCase() === h)));
  if (hi < 0) return [];
  const head = rows[hi].map((c) => clean(c).toUpperCase());
  return rows.slice(hi + 1).map((r) => {
    const o: Record<string, unknown> = {};
    head.forEach((h, i) => {
      if (h && !(h in o)) o[h] = r[i];
    });
    return o;
  });
}

function acoes(o: Record<string, unknown>): Acao[] {
  const list: Acao[] = [];
  for (let n = 1; n <= 6; n++) {
    const prazo = toISODate(o[`${n}. PRAZO`]);
    if (!prazo) continue;
    list.push({
      etapa: n,
      prazo,
      realizacao: toISODate(o[`${n}. REALIZAÇÃO`]),
      status: clean(o[`${n}. STATUS`]) || undefined,
    });
  }
  return list;
}

export function parseWorkbook(X: X, wb: XLSXNS.WorkBook): Dataset {
  const registros: Registro[] = [];

  readTable(X, wb, "BASE", ["DATA", "PREFIXO"]).forEach((o, i) => {
    const data = toISODate(o["DATA"]);
    if (!data) return;
    const hora = toHora(o["HORA"]);
    registros.push({
      id: `acc-${data}-${i}`,
      categoria: "acidente",
      data,
      hora,
      turno: clean(o["TURNO"]).toUpperCase() || turnoDaHora(hora),
      colaborador: clean(o["NOME DO COLABORADOR"]),
      prefixo: clean(o["PREFIXO"]),
      processo: PROCESSOS[clean(o["PROCESSO"]).toUpperCase()] ?? clean(o["PROCESSO"]).toUpperCase(),
      base: clean(o["BASE"]).toUpperCase(),
      cidade: clean(o["CIDADE"]),
      supervisor: clean(o["SUPERVISOR"]),
      tipo: clean(o["TIPO"]).toUpperCase(),
      caracteristica: clean(o["CARACTERÍSTICA"]).toUpperCase(),
      definicao: clean(o["DEFINIÇÃO"]),
      descricao: String(o["DESCRIÇÃO"] ?? "").trim(),
      envolvidos: clean(o["TERCEIROS ENVOLVIDOS"]).toUpperCase() === "TERCEIROS" ? "TERCEIROS" : "PRÓPRIOS",
      gravidade: clean(o["GRAVIDADE"]).toUpperCase(),
      lesao: clean(o["LESÃO"]).toUpperCase(),
      cat: clean(o["Nº DA CAT"]),
      trajeto: clean(o["TRAJETO"]).toUpperCase().replace("NAO", "NÃO"),
      comunicadoEqtl: clean(o["COMUNICADO EQTL"]).toUpperCase(),
      acoes: acoes(o),
    });
  });

  readTable(X, wb, "INCIDENTES INTERNOS", ["DATA", "PREFIXO"]).forEach((o, i) => {
    const data = toISODate(o["DATA"]);
    if (!data) return;
    registros.push({
      id: `inc-${data}-${i}`,
      categoria: "incidente_interno",
      data,
      turno: "",
      colaborador: clean(o["NOME DO COLABORADOR"]),
      prefixo: clean(o["PREFIXO"]),
      processo: PROCESSOS[clean(o["PROCESSO"]).toUpperCase()] ?? clean(o["PROCESSO"]).toUpperCase(),
      base: clean(o["BASE"]).toUpperCase(),
      cidade: clean(o["CIDADE"]),
      supervisor: clean(o["SUPERVISOR"]),
      tipo: clean(o["TIPO"]).toUpperCase().replace("VEICULO", "VEÍCULO").replace("DANO AO VEÍCULO", "DANO A VEÍCULO"),
      caracteristica: "",
      definicao: "",
      descricao: String(o["DESCRIÇÃO"] ?? "").trim(),
      envolvidos: clean(o["TERCEIROS ENVOLVIDOS"]).toUpperCase() === "SIM" ? "TERCEIROS" : "PRÓPRIOS",
      gravidade: clean(o["GRAVIDADE"]).toUpperCase(),
      lesao: clean(o["LESÃO"]).toUpperCase(),
      cat: "",
      trajeto: "",
      comunicadoEqtl: "",
      acoes: acoes(o),
    });
  });

  const taxas: Taxa[] = [];
  readTable(X, wb, "TG e TF", ["MÊS", "TG"]).forEach((o) => {
    const d = toISODate(o["MÊS"]);
    if (!d) return;
    taxas.push({
      ano: Number(d.slice(0, 4)),
      mes: Number(d.slice(5, 7)),
      tg: Number(o["TG"]) || 0,
      metaTg: Number(o["META TG"]) || 0,
      tf: Number(o["TF"]) || 0,
      tfca: Number(o["TFCA"]) || 0,
      metaTf: Number(o["META TF"]) || 0,
    });
  });

  registros.sort((a, b) => a.data.localeCompare(b.data));
  return { registros, taxas, exposicao: [], equipes: [], colaboradores: [], config: CONFIG_PADRAO, atualizadoEm: new Date().toISOString() };
}
