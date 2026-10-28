import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Registro } from "../types";
import { useData } from "./store";
import { diaDaSemana } from "./parse";

export interface Filtros {
  anos: number[];
  meses: number[];
  bases: string[];
  gerencias: string[];
  // seleções feitas clicando nos gráficos
  lesoes: string[];
  dias: string[];
  tipos: string[];
  envolvidos: string[];
  equipes: string[];
  colaboradores: string[];
  caracteristicas: string[];
  definicoes: string[];
  turnos: string[];
}
export type ChaveFiltro = keyof Filtros;

export const ROTULO_FILTRO: Record<ChaveFiltro, string> = {
  anos: "Ano",
  meses: "Mês",
  bases: "Base",
  gerencias: "Gerência",
  lesoes: "Lesão",
  dias: "Dia",
  tipos: "Tipo",
  envolvidos: "Envolvidos",
  equipes: "Equipe",
  colaboradores: "Colaborador",
  caracteristicas: "Característica",
  definicoes: "Resumo",
  turnos: "Turno",
};

const VAZIO: Filtros = { anos: [], meses: [], bases: [], gerencias: [], lesoes: [], dias: [], tipos: [], envolvidos: [], equipes: [], colaboradores: [], caracteristicas: [], definicoes: [], turnos: [] };

interface Ctx {
  filtros: Filtros;
  toggle: (k: ChaveFiltro, v: string | number) => void;
  limpar: () => void;
  limparSelecoes: () => void;
  ativos: number;
  anosDisponiveis: number[];
}

const FCtx = createContext<Ctx>(null!);
export const useFiltros = () => useContext(FCtx);

export const anoDe = (r: Registro) => Number(r.data.slice(0, 4));
export const mesDe = (r: Registro) => Number(r.data.slice(5, 7));

const TESTES: Record<ChaveFiltro, (r: Registro, f: Filtros) => boolean> = {
  anos: (r, f) => f.anos.includes(anoDe(r)),
  meses: (r, f) => f.meses.includes(mesDe(r)),
  bases: (r, f) => f.bases.includes(r.base),
  gerencias: (r, f) => f.gerencias.includes(r.processo),
  lesoes: (r, f) => f.lesoes.includes(r.lesao),
  dias: (r, f) => f.dias.includes(diaDaSemana(r.data)),
  tipos: (r, f) => f.tipos.includes(r.tipo),
  envolvidos: (r, f) => f.envolvidos.includes(r.envolvidos),
  equipes: (r, f) => f.equipes.includes(r.prefixo),
  colaboradores: (r, f) => f.colaboradores.includes(r.colaborador),
  caracteristicas: (r, f) => f.caracteristicas.includes(r.caracteristica),
  definicoes: (r, f) => f.definicoes.includes(r.definicao.toUpperCase()),
  turnos: (r, f) => f.turnos.includes(r.turno),
};

/** Aplica os filtros; `ignorar` omite algumas dimensões (cada gráfico ignora a própria seleção para continuar mostrando todas as opções). */
export function aplicar(regs: Registro[], f: Filtros, opts: { ignorar?: ChaveFiltro[] } = {}) {
  const ativos = (Object.keys(TESTES) as ChaveFiltro[]).filter((k) => f[k].length && !opts.ignorar?.includes(k));
  return ativos.length ? regs.filter((r) => ativos.every((k) => TESTES[k](r, f))) : regs;
}

export function FiltrosProvider({ children }: { children: ReactNode }) {
  const { data } = useData();
  const anosDisponiveis = useMemo(
    () => [...new Set([...data.registros.map(anoDe), ...data.taxas.map((t) => t.ano)])].sort(),
    [data],
  );
  const [filtros, setFiltros] = useState<Filtros>(() => ({
    ...VAZIO,
    anos: anosDisponiveis.length ? [anosDisponiveis[anosDisponiveis.length - 1]] : [],
  }));

  // com os dados vindos do banco (assíncronos), o ano mais recente é escolhido assim que aparecem, se ninguém mexeu nos filtros
  const mexeu = useRef(false);
  useEffect(() => {
    if (mexeu.current || !anosDisponiveis.length) return;
    setFiltros((f) => (f.anos.length ? f : { ...f, anos: [anosDisponiveis[anosDisponiveis.length - 1]] }));
  }, [anosDisponiveis]);

  const toggle: Ctx["toggle"] = (k, v) => {
    mexeu.current = true;
    setFiltros((f) => {
      const cur = f[k] as (string | number)[];
      return { ...f, [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
    });
  };

  const limpar = () => {
    mexeu.current = true;
    setFiltros(VAZIO);
  };
  const limparSelecoes = () => {
    mexeu.current = true;
    setFiltros((f) => ({ ...VAZIO, anos: f.anos }));
  };
  const ativos = (Object.keys(VAZIO) as ChaveFiltro[]).reduce((s, k) => s + filtros[k].length, 0);

  return (
    <FCtx.Provider value={{ filtros, toggle, limpar, limparSelecoes, ativos, anosDisponiveis }}>{children}</FCtx.Provider>
  );
}
