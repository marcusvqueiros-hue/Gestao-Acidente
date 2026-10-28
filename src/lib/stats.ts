import type { Registro } from "../types";
import { LESOES } from "../types";
import { mesDe } from "./filters";

export const PALETA = ["#8c1c3d", "#d9485f", "#e8a0a8", "#5f6b73", "#b79aae", "#2d2830", "#c98a3d", "#3d7a8c"];

export const COR_LESAO: Record<string, string> = {
  "COM AFASTAMENTO": "#6b1a28",
  FATAL: "#17141a",
  INCIDENTE: "#8b979b",
  "SEM AFASTAMENTO": "#e06c75",
};

export function contar<T>(items: T[], key: (r: T) => string) {
  const m = new Map<string, number>();
  for (const r of items) {
    const k = key(r);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export function porMes(regs: Registro[]) {
  return Array.from({ length: 12 }, (_, i) => {
    const doMes = regs.filter((r) => mesDe(r) === i + 1);
    const o: Record<string, number> = { mes: i + 1, total: doMes.length };
    for (const l of LESOES) o[l] = doMes.filter((r) => r.lesao === l).length;
    return o;
  });
}

export function resumo(regs: Registro[]) {
  const n = (l: string) => regs.filter((r) => r.lesao === l).length;
  return {
    total: regs.length,
    sem: n("SEM AFASTAMENTO"),
    com: n("COM AFASTAMENTO"),
    incidente: n("INCIDENTE"),
    fatal: n("FATAL"),
  };
}

/** Dias corridos desde o último evento com afastamento (ou fatal). */
export function diasSemAfastamento(regs: Registro[], hoje = new Date()) {
  const datas = regs
    .filter((r) => r.categoria === "acidente" && (r.lesao === "COM AFASTAMENTO" || r.lesao === "FATAL"))
    .map((r) => r.data)
    .sort();
  if (!datas.length) return null;
  const ult = new Date(datas[datas.length - 1] + "T12:00:00");
  const ref = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 12);
  return { dias: Math.max(0, Math.round((ref.getTime() - ult.getTime()) / 864e5)), desde: datas[datas.length - 1] };
}

export const fmtData = (iso: string) => iso.split("-").reverse().join("/");
export const fmtDataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }).replace(",", "");
export const fmtNum = (n: number, d = 2) => n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
