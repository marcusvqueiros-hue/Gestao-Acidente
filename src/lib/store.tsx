import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Colaborador, ConfigTaxas, Dataset, Equipe, Registro, Taxa } from "../types";
import { CONFIG_PADRAO } from "../types";
import { useAuth } from "./auth";
import { supabase } from "./supabase";
import { definirEquipes } from "./equipes";
import { definirColaboradores } from "./colaboradores";
import { apagarRegistro, carregarDataset, gravarConfig, gravarEquipes, gravarExposicao, gravarRegistro, gravarTaxa, substituirTudo } from "./db";

const KEY = "cgb.dataset.v1";
const VAZIO = (): Dataset => ({ registros: [], taxas: [], exposicao: [], equipes: [], colaboradores: [], config: CONFIG_PADRAO, atualizadoEm: new Date().toISOString() });

const novoId = () =>
  globalThis.crypto?.randomUUID?.() ?? `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function loadLocal(): Dataset {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...VAZIO(), ...(JSON.parse(raw) as Partial<Dataset>) } as Dataset;
  } catch {
    /* storage indisponível */
  }
  return VAZIO();
}

/** Cada operação devolve a mensagem de erro, ou null quando deu certo. */
type Resultado = Promise<string | null>;

interface DataCtx {
  data: Dataset;
  carregando: boolean;
  erro: string | null;
  nuvem: boolean;
  addRegistro: (r: Omit<Registro, "id">) => Resultado;
  updateRegistro: (r: Registro) => Resultado;
  removeRegistro: (id: string) => Resultado;
  setTaxa: (t: Taxa) => Resultado;
  setExposicao: (ano: number, mes: number, horas: number) => Resultado;
  setConfig: (c: ConfigTaxas) => Resultado;
  setEquipes: (lista: Equipe[]) => Resultado;
  replaceAll: (d: Dataset) => Resultado;
  recarregar: () => Promise<void>;
}

const Ctx = createContext<DataCtx>(null!);
export const useData = () => useContext(Ctx);

const NEGADO = "Apenas administradores podem alterar os dados.";
const NEGADO_REG = "Seu perfil não permite registrar acidentes.";

export function DataProvider({ children }: { children: ReactNode }) {
  const { admin, registra } = useAuth();
  const nuvem = !!supabase;
  const [data, setData] = useState<Dataset>(nuvem ? VAZIO : loadLocal);
  const [carregando, setCarregando] = useState(nuvem);
  const [erro, setErro] = useState<string | null>(null);
  definirEquipes(data.equipes ?? []); // cadastro de equipes consultado por filtros e gráficos
  definirColaboradores(data.colaboradores ?? []);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const recarregar = useCallback(async () => {
    if (!supabase) return;
    try {
      setData(await carregarDataset());
      setErro(null);
    } catch (e) {
      setErro((e as { message?: string })?.message ?? "Não foi possível carregar os dados.");
    } finally {
      setCarregando(false);
    }
  }, []);

  // nuvem: carga inicial + atualização em tempo real (mudanças feitas em outros aparelhos)
  useEffect(() => {
    if (!supabase) return;
    recarregar();
    const agendar = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(recarregar, 700);
    };
    const canal = supabase
      .channel("dados-acidentes")
      .on("postgres_changes", { event: "*", schema: "public", table: "registros" }, agendar)
      .on("postgres_changes", { event: "*", schema: "public", table: "taxas" }, agendar)
      .subscribe();
    return () => {
      clearTimeout(timer.current);
      supabase!.removeChannel(canal);
    };
  }, [recarregar]);

  // local: persiste no navegador
  useEffect(() => {
    if (nuvem) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* ignora */
    }
  }, [data, nuvem]);

  const agora = () => new Date().toISOString();

  const addRegistro = useCallback(
    async (r: Omit<Registro, "id">): Resultado => {
      if (!registra) return NEGADO_REG;
      const novo: Registro = { ...r, id: novoId() };
      if (nuvem) {
        const e = await gravarRegistro(novo);
        if (e) return e;
      }
      setData((d) => ({ ...d, registros: [...d.registros, novo], atualizadoEm: agora() }));
      return null;
    },
    [registra, nuvem],
  );

  const updateRegistro = useCallback(
    async (r: Registro): Resultado => {
      if (!registra) return NEGADO_REG;
      if (nuvem) {
        const e = await gravarRegistro(r);
        if (e) return e;
      }
      setData((d) => ({ ...d, registros: d.registros.map((x) => (x.id === r.id ? r : x)), atualizadoEm: agora() }));
      return null;
    },
    [registra, nuvem],
  );

  const removeRegistro = useCallback(
    async (id: string): Resultado => {
      if (!registra) return NEGADO_REG;
      if (nuvem) {
        const e = await apagarRegistro(id);
        if (e) return e;
      }
      setData((d) => ({ ...d, registros: d.registros.filter((x) => x.id !== id), atualizadoEm: agora() }));
      return null;
    },
    [registra, nuvem],
  );

  const setTaxa = useCallback(
    async (t: Taxa): Resultado => {
      if (!admin) return NEGADO;
      if (nuvem) {
        const e = await gravarTaxa(t);
        if (e) return e;
      }
      setData((d) => {
        const rest = d.taxas.filter((x) => !(x.ano === t.ano && x.mes === t.mes));
        return { ...d, taxas: [...rest, t].sort((a, b) => a.ano - b.ano || a.mes - b.mes), atualizadoEm: agora() };
      });
      return null;
    },
    [admin, nuvem],
  );

  const setExposicao = useCallback(
    async (ano: number, mes: number, horas: number): Resultado => {
      if (!admin) return NEGADO;
      if (nuvem) {
        const e = await gravarExposicao({ ano, mes, horas });
        if (e) return e;
      }
      setData((d) => {
        const rest = d.exposicao.filter((x) => !(x.ano === ano && x.mes === mes));
        return { ...d, exposicao: horas > 0 ? [...rest, { ano, mes, horas }].sort((a, b) => a.ano - b.ano || a.mes - b.mes) : rest, atualizadoEm: agora() };
      });
      return null;
    },
    [admin, nuvem],
  );

  const setConfig = useCallback(
    async (config: ConfigTaxas): Resultado => {
      if (!admin) return NEGADO;
      if (nuvem) {
        const e = await gravarConfig(config);
        if (e) return e;
      }
      setData((d) => ({ ...d, config, atualizadoEm: agora() }));
      return null;
    },
    [admin, nuvem],
  );

  const setEquipes = useCallback(
    async (lista: Equipe[]): Resultado => {
      if (!admin) return NEGADO;
      if (nuvem) {
        const e = await gravarEquipes(lista);
        if (e) return e;
      }
      setData((d) => ({ ...d, equipes: lista, atualizadoEm: agora() }));
      return null;
    },
    [admin, nuvem],
  );

  const replaceAll = useCallback(
    async (d: Dataset): Resultado => {
      if (!admin) return NEGADO;
      if (nuvem) {
        const e = await substituirTudo(d);
        if (e) {
          await recarregar();
          return e;
        }
      }
      setData((atual) => ({ ...d, exposicao: atual.exposicao, equipes: atual.equipes, colaboradores: atual.colaboradores, config: atual.config, atualizadoEm: agora() }));
      return null;
    },
    [admin, nuvem, recarregar],
  );

  const value = useMemo(
    () => ({ data, carregando, erro, nuvem, addRegistro, updateRegistro, removeRegistro, setTaxa, setExposicao, setConfig, setEquipes, replaceAll, recarregar }),
    [data, carregando, erro, nuvem, addRegistro, updateRegistro, removeRegistro, setTaxa, setExposicao, setConfig, setEquipes, replaceAll, recarregar],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
