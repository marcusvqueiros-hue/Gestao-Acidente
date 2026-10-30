import type { Registro } from "../types";
import { equipeDe, listaCoordenadoresEquipes } from "./equipes";

/** Quem coordena cada gerência/base. Regra de negócio informada pela empresa: ajuste aqui quando mudar. */
const REGRAS: { gerencia: string; bases?: string[]; coordenador: string }[] = [
  { gerencia: "GOMAN", bases: ["BCB", "STI", "SIT", "ITM"], coordenador: "Luis C." },
  { gerencia: "GOMAN", bases: ["PDS"], coordenador: "Thiago F." },
  { gerencia: "GOMAN", bases: ["PDT"], coordenador: "Rafaela" },
  { gerencia: "GOMAN", bases: ["BDC"], coordenador: "Jackson" },
  { gerencia: "SPOT", bases: ["BDC"], coordenador: "Jackson" },
  { gerencia: "SPOT", bases: ["STI"], coordenador: "Marcos" },
  { gerencia: "GERE", coordenador: "Antonio M." },
  { gerencia: "GSTC", bases: ["BCB", "ITM", "STI"], coordenador: "Afonso" },
  { gerencia: "GSTC", bases: ["PDS", "PDT", "BDC"], coordenador: "Paulo" },
  { gerencia: "ADM", coordenador: "Pryscilla" },
  { gerencia: "ALMOX", coordenador: "Camila" },
  { gerencia: "FROTA", coordenador: "Ruan" },
  { gerencia: "LOG", coordenador: "Ruan" },
  { gerencia: "SESMT", coordenador: "Daniel" },
];

export const SEM_COORDENADOR = "Sem coordenador definido";

const DAS_REGRAS = [...new Set(REGRAS.map((r) => r.coordenador))];
export const NOMES_DAS_REGRAS = DAS_REGRAS;
/** Regras fixas + coordenadores que aparecem no cadastro de equipes. */
export const listaCoordenadores = () => [...new Set([...DAS_REGRAS, ...listaCoordenadoresEquipes()])];

/** A coordenação da equipe (cadastro de equipes) vale primeiro; sem prefixo cadastrado, vale a regra por gerência/base. */
export const coordenadorDe = (r: Pick<Registro, "processo" | "base" | "prefixo">) =>
  equipeDe(r.prefixo)?.coordenador ||
  REGRAS.find((x) => x.gerencia === r.processo && (!x.bases || x.bases.includes(r.base)))?.coordenador ||
  SEM_COORDENADOR;
