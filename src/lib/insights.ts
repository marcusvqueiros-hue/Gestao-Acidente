import type { AcaoPlano, Dataset, Registro } from "../types";
import { sinistroDa, situacaoEfetiva, completa, hojeISO } from "./plano";
import { serieTaxas } from "./taxas";

export type Nivel = "critico" | "atencao" | "oportunidade" | "positivo";
export const ROTULO_NIVEL: Record<Nivel, string> = { critico: "Crítico", atencao: "Atenção", oportunidade: "Oportunidade", positivo: "Ponto positivo" };
export const COR_NIVEL: Record<Nivel, string> = { critico: "#e0566f", atencao: "#f2b01e", oportunidade: "#3fb6c4", positivo: "#22b45f" };
const PESO_NIVEL: Record<Nivel, number> = { critico: 0, atencao: 1, oportunidade: 2, positivo: 3 };

export interface Insight {
  id: string;
  nivel: Nivel;
  eixo: "Gravidade" | "Tipologia" | "Tendência" | "Onde e quando" | "Plano de ação" | "Taxas";
  titulo: string;
  leitura: string; // o que os dados mostram
  evidencias: string[]; // números de apoio
  acao: string; // o que fazer
}

export interface Prioridade {
  familia: string;
  eventos: number;
  graves: number; // com afastamento + fatais
  risco: number; // pontuação ponderada pela gravidade
  parte: number; // % do risco total
}

/** Peso de cada sinistro pela gravidade: o objetivo é reduzir o que machuca mais, não só contar eventos. */
export const pesoGravidade = (r: Registro) =>
  r.lesao === "FATAL" ? 100 : r.lesao === "COM AFASTAMENTO" ? 25 + Math.min(r.diasPerdidos ?? 0, 60) / 4 : r.lesao === "SEM AFASTAMENTO" ? 3 : 1;

/** Grupos de tipologia usados para priorizar e recomendar (a característica do registro é muito detalhada). */
export function familiaDe(r: Pick<Registro, "caracteristica" | "tipo">): string {
  const t = `${r.caracteristica} ${r.tipo}`.toUpperCase();
  if (/TR[ÂA]NSITO|COLIS|ATROPEL|CAPOT|TOMBAMENTO/.test(t)) return "Trânsito / veículos";
  if (/ELETRIC|CHOQUE|ARCO/.test(t)) return "Contato com eletricidade";
  if (/QUEDA/.test(t)) return "Queda";
  if (/IMPACTO|PRENSAMENTO|GOLPE|ATINGIDO|ESMAGAMENTO/.test(t)) return "Impacto / prensamento";
  if (/ANIMA|INSETO|PEÇONHENTO|ABELHA/.test(t)) return "Animais e insetos";
  if (/CORTE|PERFURA/.test(t)) return "Corte / perfuração";
  return r.caracteristica ? "Outras tipologias" : "Sem característica informada";
}

/** O que a boa prática recomenda para reduzir cada família (linguagem de gestão, adaptável ao contexto da CGB). */
export const RECOMENDACAO: Record<string, string> = {
  "Trânsito / veículos":
    "Reforçar a gestão de condução: direção defensiva com reciclagem para quem já se envolveu, telemetria com alerta de velocidade e frenagem, regras de distância e de ultrapassagem, inspeção de pré-uso do veículo e política de consequência para infrações. Em colisões causadas por terceiros, avaliar rotas e horários de maior exposição e o uso de sinalização refletiva.",
  "Contato com eletricidade":
    "Tratar como potencial de fatalidade mesmo sem lesão: bloqueio e aterramento com checagem em duas pessoas antes de iniciar, parada obrigatória quando houver mudança de condição, verificação de ausência de tensão, EPI e EPC dentro da validade e reciclagem em NR-10 / SEP com foco no evento ocorrido.",
  Queda:
    "Revisar o trabalho em altura e a circulação em desnível: ancoragem e linha de vida verificadas no pré-uso, inspeção de escadas e plataformas, trava-quedas e dupla conferência do cinto, e análise preliminar de risco antes de cada subida.",
  "Impacto / prensamento":
    "Reforçar o isolamento da área e a comunicação da equipe (quem opera, quem sinaliza), revisar o uso de ferramentas improvisadas, luvas e ponto de pinçamento nas tarefas manuais, e a organização da movimentação de cargas.",
  "Animais e insetos":
    "Reconhecimento prévio da área antes da tarefa (ninhos, colmeias, ponto de passagem), kit de primeiros socorros e orientação de resposta rápida, repelente e vestimenta adequada nas frentes de poda e roçada.",
  "Corte / perfuração": "Ferramentas de corte corretas e em bom estado, proteção de mão e antebraço, treinamento de técnica e proibição de ferramenta improvisada.",
  "Outras tipologias": "Padronizar a característica no registro para permitir análise de causa e priorizar as ações.",
  "Sem característica informada": "Completar a característica no registro: sem ela não é possível priorizar a causa.",
};

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const nomeMes = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const contar = <T,>(l: T[], f: (x: T) => string) => {
  const m = new Map<string, number>();
  for (const x of l) {
    const k = f(x);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([nome, n]) => ({ nome, n })).sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome));
};
const lista = (itens: string[], max = 3) => itens.slice(0, max).join(", ");

export interface Analise {
  ano: number;
  mesAtual: number; // até que mês o ano tem dados (mês do último registro, ou 12 para anos fechados)
  regs: Registro[]; // sinistros do ano
  anterior: Registro[]; // mesmo período do ano anterior
  total: number;
  totalAnt: number;
  graves: number;
  gravesAnt: number;
  fatais: number;
  semAfast: number;
  riscoTotal: number;
  prioridades: Prioridade[];
  porMesRisco: { mes: number; eventos: number; risco: number }[];
  insights: Insight[];
  resumo: string[];
}

export function analisar(d: Dataset, ano: number, hojeIso = hojeISO()): Analise {
  const todos = d.registros.filter((r) => r.categoria === "acidente");
  const regs = todos.filter((r) => r.data.startsWith(String(ano)));
  const ultimo = regs.reduce((m, r) => (r.data > m ? r.data : m), "");
  const hojeAno = Number(hojeIso.slice(0, 4));
  const mesAtual = ano < hojeAno ? 12 : ano > hojeAno ? 0 : Number(hojeIso.slice(5, 7));
  const mesLimite = ultimo && ano === hojeAno ? Math.max(Number(ultimo.slice(5, 7)), mesAtual) : mesAtual || 12;
  const anterior = todos.filter((r) => r.data.startsWith(String(ano - 1)) && Number(r.data.slice(5, 7)) <= mesLimite);
  const eGrave = (r: Registro) => r.lesao === "FATAL" || r.lesao === "COM AFASTAMENTO";
  const graves = regs.filter(eGrave);
  const gravesAnt = anterior.filter(eGrave);
  const fatais = regs.filter((r) => r.lesao === "FATAL");
  const semAfast = regs.filter((r) => r.lesao === "SEM AFASTAMENTO");
  const riscoTotal = regs.reduce((s, r) => s + pesoGravidade(r), 0);

  // prioridades por família de tipologia
  const porFam = new Map<string, Registro[]>();
  for (const r of regs) porFam.set(familiaDe(r), [...(porFam.get(familiaDe(r)) ?? []), r]);
  const prioridades: Prioridade[] = [...porFam.entries()]
    .map(([familia, l]) => {
      const risco = l.reduce((s, r) => s + pesoGravidade(r), 0);
      return { familia, eventos: l.length, graves: l.filter(eGrave).length, risco, parte: pct(risco, riscoTotal) };
    })
    .sort((a, b) => b.risco - a.risco);

  const porMesRisco = Array.from({ length: 12 }, (_, i) => {
    const l = regs.filter((r) => Number(r.data.slice(5, 7)) === i + 1);
    return { mes: i + 1, eventos: l.length, risco: Math.round(l.reduce((s, r) => s + pesoGravidade(r), 0)) };
  });

  const ins: Insight[] = [];
  const add = (i: Insight) => ins.push(i);

  /* ---------- Gravidade ---------- */
  if (fatais.length) {
    add({
      id: "fatal", nivel: "critico", eixo: "Gravidade",
      titulo: `${fatais.length} sinistro(s) fatal(is) em ${ano}`,
      leitura: "Qualquer fatalidade exige aprendizado imediato e a verificação de que o mesmo cenário não existe em outras frentes.",
      evidencias: fatais.map((r) => `${r.data.split("-").reverse().join("/")} · ${r.base} · ${r.caracteristica || r.tipo}`),
      acao: "Replicar a investigação em todas as bases com o mesmo tipo de atividade, bloquear a tarefa até a revisão do procedimento e confirmar que as ações do plano foram concluídas e verificadas em campo.",
    });
  }
  if (graves.length) {
    const fam = contar(graves, familiaDe);
    const dias = graves.reduce((s, r) => s + (r.diasPerdidos ?? 0), 0);
    add({
      id: "graves", nivel: graves.length > gravesAnt.length ? "critico" : "atencao", eixo: "Gravidade",
      titulo: `${graves.length} sinistro(s) com afastamento ou fatal${gravesAnt.length ? ` (${gravesAnt.length} no mesmo período de ${ano - 1})` : ""}`,
      leitura: `Eles concentram ${pct(graves.reduce((s, r) => s + pesoGravidade(r), 0), riscoTotal)}% do risco ponderado do ano, mesmo sendo ${pct(graves.length, regs.length)}% dos eventos. Reduzir a gravidade é o que mais move as taxas TFCA e TG.`,
      evidencias: [`Famílias: ${lista(fam.map((f) => `${f.nome} (${f.n})`))}`, ...(dias ? [`${dias} dia(s) perdidos registrados`] : []), ...graves.slice(0, 3).map((r) => `${r.data.split("-").reverse().join("/")} · ${r.base} · ${r.caracteristica || r.tipo}`)],
      acao: "Para cada caso, confirmar a causa raiz (não só o ato inseguro), o controle que falhou e se existe barreira física ou de engenharia que dispense a dependência do comportamento.",
    });
  } else if (regs.length) {
    add({
      id: "sem-graves", nivel: "positivo", eixo: "Gravidade",
      titulo: "Nenhum sinistro com afastamento no período",
      leitura: "Todos os eventos do ano foram sem afastamento ou incidentes. Vale manter a atenção aos eventos de alto potencial, que podem esconder a próxima ocorrência grave.",
      evidencias: [`${regs.length} evento(s) no total`],
      acao: "Usar os eventos de maior potencial como alerta para antecipar o controle, sem esperar uma lesão para agir.",
    });
  }

  // eventos de alto potencial de gravidade sem lesão grave
  const potencial = regs.filter((r) => !eGrave(r) && ["Contato com eletricidade", "Queda"].includes(familiaDe(r)));
  if (potencial.length) {
    add({
      id: "potencial", nivel: potencial.length >= 3 ? "critico" : "atencao", eixo: "Gravidade",
      titulo: `${potencial.length} evento(s) de alto potencial sem lesão grave`,
      leitura: "Choque elétrico e quedas raramente têm uma segunda chance: a diferença entre um evento sem afastamento e uma fatalidade costuma ser sorte. A pirâmide de gravidade indica tratá-los como graves.",
      evidencias: [`Famílias: ${lista(contar(potencial, familiaDe).map((f) => `${f.nome} (${f.n})`))}`, ...potencial.slice(0, 3).map((r) => `${r.data.split("-").reverse().join("/")} · ${r.base} · ${r.caracteristica}`)],
      acao: "Abrir investigação completa, como se tivesse havido afastamento, e checar a eficácia dos bloqueios e do trabalho em altura nas equipes das bases envolvidas.",
    });
  }

  /* ---------- Tipologia ---------- */
  if (prioridades.length) {
    const topo = prioridades[0];
    const top3 = prioridades.slice(0, 3).reduce((s, p) => s + p.parte, 0);
    add({
      id: "pareto", nivel: topo.parte >= 50 ? "critico" : topo.parte >= 35 ? "atencao" : "oportunidade", eixo: "Tipologia",
      titulo: `${topo.familia} responde por ${topo.parte}% do risco do ano`,
      leitura: `São ${topo.eventos} evento(s), dos quais ${topo.graves} grave(s). As três principais famílias somam ${top3}% do risco: é aí que a ação gera mais redução de sinistros e de gravidade.`,
      evidencias: prioridades.slice(0, 4).map((p) => `${p.familia}: ${p.eventos} evento(s), ${p.graves} grave(s), ${p.parte}% do risco`),
      acao: RECOMENDACAO[topo.familia] ?? "Priorizar a causa raiz desta família nos planos de ação.",
    });
    for (const p of prioridades.slice(1, 3)) {
      if (p.parte < 12) continue;
      add({
        id: `fam-${p.familia}`, nivel: p.graves ? "atencao" : "oportunidade", eixo: "Tipologia",
        titulo: `${p.familia}: ${p.eventos} evento(s) e ${p.parte}% do risco`,
        leitura: p.graves ? "Já produziu sinistro com afastamento no ano." : "Sem afastamento até agora, mas é a segunda frente de maior risco ponderado.",
        evidencias: [`${p.graves} grave(s) · ${p.eventos - p.graves} sem afastamento ou incidente`],
        acao: RECOMENDACAO[p.familia] ?? "Detalhar a causa raiz e definir controles.",
      });
    }
  }
  const semCarac = regs.filter((r) => !r.caracteristica).length;
  if (semCarac) {
    add({ id: "carac", nivel: "oportunidade", eixo: "Tipologia", titulo: `${semCarac} sinistro(s) sem característica`, leitura: "Sem a característica não dá para priorizar a causa nem recomendar controles.", evidencias: [], acao: "Completar a característica nos registros." });
  }

  /* ---------- Tendência ---------- */
  if (anterior.length && regs.length) {
    const v = pct(regs.length - anterior.length, anterior.length);
    add({
      id: "tendencia", nivel: regs.length > anterior.length ? "atencao" : "positivo", eixo: "Tendência",
      titulo: regs.length > anterior.length ? `Sinistros ${v}% acima do mesmo período de ${ano - 1}` : regs.length < anterior.length ? `Sinistros ${Math.abs(v)}% abaixo do mesmo período de ${ano - 1}` : `Mesmo número de sinistros de ${ano - 1}`,
      leitura: `${regs.length} em ${ano} contra ${anterior.length} no mesmo período do ano anterior.`,
      evidencias: [],
      acao: regs.length > anterior.length ? "Identificar o que mudou (equipes novas, volume de trabalho, sazonalidade) e atacar primeiro as famílias que mais cresceram." : "Documentar o que funcionou para padronizar entre as bases.",
    });
    const famAtual = contar(regs, familiaDe);
    const cresc = famAtual
      .map((f) => ({ ...f, ant: anterior.filter((r) => familiaDe(r) === f.nome).length }))
      .filter((f) => f.n - f.ant >= 3)
      .sort((a, b) => b.n - b.ant - (a.n - a.ant));
    if (cresc.length) {
      add({
        id: "cresc", nivel: "atencao", eixo: "Tendência",
        titulo: `${cresc[0].nome} cresceu: ${cresc[0].ant} → ${cresc[0].n} evento(s)`,
        leitura: "A família que mais subiu em relação ao mesmo período do ano passado merece uma ação específica antes de virar padrão.",
        evidencias: cresc.slice(0, 3).map((f) => `${f.nome}: ${f.ant} → ${f.n}`),
        acao: RECOMENDACAO[cresc[0].nome] ?? "Investigar a causa do aumento.",
      });
    }
  }
  // últimos 3 meses vs 3 anteriores
  if (mesLimite >= 6) {
    const dentro = (r: Registro, a: number, b: number) => {
      const m = Number(r.data.slice(5, 7));
      return m >= a && m <= b;
    };
    const rec = regs.filter((r) => dentro(r, mesLimite - 2, mesLimite)).length;
    const ant3 = regs.filter((r) => dentro(r, mesLimite - 5, mesLimite - 3)).length;
    if (ant3 && rec >= ant3 * 1.4 && rec - ant3 >= 3) {
      add({ id: "tri", nivel: "atencao", eixo: "Tendência", titulo: "Aceleração nos últimos 3 meses", leitura: `${rec} sinistros nos 3 últimos meses contra ${ant3} nos 3 anteriores.`, evidencias: [], acao: "Reunião rápida com coordenadores das bases mais atingidas para ajustar as ações antes do fechamento do trimestre." });
    }
  }

  /* ---------- Onde e quando ---------- */
  const bases = contar(regs, (r) => r.base);
  if (bases.length > 1 && regs.length >= 10) {
    const b = bases[0];
    if (pct(b.n, regs.length) >= 28) {
      add({
        id: "base", nivel: "atencao", eixo: "Onde e quando",
        titulo: `Base ${b.nome} concentra ${pct(b.n, regs.length)}% dos sinistros`,
        leitura: `${b.n} de ${regs.length} eventos. As bases ${lista(bases.slice(1).map((x) => `${x.nome} (${x.n})`))} aparecem em seguida.`,
        evidencias: [`Famílias na base ${b.nome}: ${lista(contar(regs.filter((r) => r.base === b.nome), familiaDe).map((f) => `${f.nome} (${f.n})`))}`],
        acao: `Diagnóstico dirigido em ${b.nome}: acompanhamento em campo pela liderança, conferência dos procedimentos das principais famílias e reunião mensal de indicadores com a coordenação local.`,
      });
    }
  }
  const ger = contar(regs, (r) => r.processo);
  if (ger.length > 1 && regs.length >= 10 && pct(ger[0].n, regs.length) >= 45) {
    add({ id: "ger", nivel: "atencao", eixo: "Onde e quando", titulo: `Gerência ${ger[0].nome} responde por ${pct(ger[0].n, regs.length)}% dos eventos`, leitura: `${ger[0].n} de ${regs.length} sinistros.`, evidencias: ger.slice(0, 3).map((g) => `${g.nome}: ${g.n}`), acao: "Cobrar da gerência um plano específico de redução, com metas por base e acompanhamento no relatório de Plano de Ação." });
  }
  // reincidência de colaboradores e equipes
  const colab = contar(regs, (r) => r.colaborador.trim().toUpperCase()).filter((c) => c.n >= 2 && !/^(EQUIPE|FISCAL|SUPERVISOR)/.test(c.nome));
  if (colab.length) {
    add({
      id: "reinc", nivel: colab.some((c) => c.n >= 3) ? "critico" : "atencao", eixo: "Onde e quando",
      titulo: `${colab.length} colaborador(es) com mais de um sinistro no ano`,
      leitura: "A reincidência aponta falta de aderência a procedimento, treinamento insuficiente ou exposição maior a risco. Acompanhamento individual costuma reduzir a repetição.",
      evidencias: colab.slice(0, 4).map((c) => `${c.nome}: ${c.n} evento(s)`),
      acao: "Conversa individual com a liderança, reciclagem direcionada ao tipo de evento, avaliação de aptidão para a função e acompanhamento por 90 dias.",
    });
  }
  const equipes = contar(regs, (r) => r.prefixo.trim().toUpperCase()).filter((e) => e.n >= 3 && !/^(FISCAL|SUPERVISOR|LEVANTADOR)$/.test(e.nome));
  if (equipes.length) {
    add({
      id: "equipes", nivel: "atencao", eixo: "Onde e quando",
      titulo: `${equipes.length} equipe(s)/prefixo(s) com 3 ou mais sinistros`,
      leitura: "Prefixos repetidos indicam um padrão de equipe: composição, veículo, tipo de serviço ou supervisão.",
      evidencias: equipes.slice(0, 4).map((e) => `${e.nome}: ${e.n}`),
      acao: "Auditar a equipe em campo (rotina de DDS, APR, pré-uso), revisar a composição e o veículo e definir um supervisor de referência para acompanhar a melhora.",
    });
  }
  const dias = contar(regs, (r) => ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][new Date(r.data + "T12:00:00").getDay()]);
  if (dias.length && regs.length >= 15 && pct(dias[0].n, regs.length) >= 24) {
    add({ id: "dia", nivel: "oportunidade", eixo: "Onde e quando", titulo: `${dias[0].nome[0].toUpperCase() + dias[0].nome.slice(1)} concentra ${pct(dias[0].n, regs.length)}% dos sinistros`, leitura: `Os dias seguintes são ${lista(dias.slice(1).map((x) => `${x.nome} (${x.n})`))}.`, evidencias: [], acao: "Reforçar o DDS e a abordagem de campo neste dia e observar se há carga de trabalho ou volume de deslocamento maior." });
  }
  const turnos = contar(regs, (r) => r.turno);
  if (turnos.length > 1 && regs.length >= 15 && pct(turnos[0].n, regs.length) >= 50) {
    add({ id: "turno", nivel: "oportunidade", eixo: "Onde e quando", titulo: `Turno da ${turnos[0].nome.toLowerCase()} concentra ${pct(turnos[0].n, regs.length)}% dos eventos`, leitura: `${turnos[0].n} de ${regs.length} com turno informado.`, evidencias: [], acao: "Concentrar a presença da liderança e das inspeções de campo neste turno." });
  }
  const trajeto = regs.filter((r) => /SIM|TRAJETO/i.test(r.trajeto ?? "") || /TRAJETO/i.test(r.caracteristica));
  if (trajeto.length >= 2) {
    add({ id: "trajeto", nivel: "oportunidade", eixo: "Onde e quando", titulo: `${trajeto.length} sinistro(s) de trajeto`, leitura: "Eventos no deslocamento casa-trabalho não entram nas taxas, mas pesam na saúde e no afastamento.", evidencias: [], acao: "Campanha de condução segura no trajeto e orientação sobre fadiga em jornadas estendidas." });
  }
  const terceiros = regs.filter((r) => r.envolvidos === "TERCEIROS").length;
  if (regs.length >= 10 && pct(terceiros, regs.length) >= 35) {
    add({ id: "terceiros", nivel: "oportunidade", eixo: "Onde e quando", titulo: `${pct(terceiros, regs.length)}% dos sinistros envolvem terceiros`, leitura: "Boa parte das colisões é causada por outros condutores. Aí a redução vem de exposição e de condução defensiva, não só de conduta interna.", evidencias: [`${terceiros} de ${regs.length} eventos`], acao: "Revisar rotas e horários de maior exposição, reforçar a distância de segurança e a sinalização dos veículos e acionar as concessionárias/órgãos de trânsito nos pontos críticos." });
  }

  /* ---------- Plano de ação ---------- */
  const acoes: AcaoPlano[] = (d.acoes ?? []).filter((a) => a.dataEvento.startsWith(String(ano)) && completa(a));
  const ligadas = acoes.map((a) => ({ a, s: sinistroDa(a, regs), sit: situacaoEfetiva(a, hojeIso) }));
  const comPlano = new Set(ligadas.map((x) => x.s?.id).filter(Boolean));
  const gravesSemPlano = graves.filter((r) => !comPlano.has(r.id));
  if (gravesSemPlano.length) {
    add({
      id: "graves-sem-plano", nivel: "critico", eixo: "Plano de ação",
      titulo: `${gravesSemPlano.length} sinistro(s) grave(s) sem plano de ação`,
      leitura: "Todo sinistro com afastamento ou fatal precisa de plano com responsável e prazo: é o controle que impede a repetição.",
      evidencias: gravesSemPlano.map((r) => `${r.data.split("-").reverse().join("/")} · ${r.colaborador} · ${r.base}`),
      acao: "Cadastrar o plano no relatório de Plano de Ação hoje, com responsável e prazo curtos.",
    });
  }
  const atrasadas = ligadas.filter((x) => x.sit === "ATRASADO");
  if (atrasadas.length) {
    const resp = contar(atrasadas.map((x) => x.a), (a) => a.responsavel.split("(")[0].trim());
    add({
      id: "atrasadas", nivel: atrasadas.length >= 5 ? "critico" : "atencao", eixo: "Plano de ação",
      titulo: `${atrasadas.length} ação(ões) do plano atrasada(s)`,
      leitura: `${pct(atrasadas.length, ligadas.length)}% das ações com prazo vencido. Ação atrasada é controle que continua desativado.`,
      evidencias: [`Mais atrasos com: ${lista(resp.map((r) => `${r.nome} (${r.n})`))}`],
      acao: "Reunião de cobrança semanal com os responsáveis, replanejamento de prazo com justificativa e escalonamento ao gerente para o que passar de 30 dias.",
    });
  }
  const semPlano = regs.filter((r) => !comPlano.has(r.id));
  if (regs.length >= 5 && semPlano.length / regs.length > 0.4) {
    add({ id: "cobertura", nivel: "atencao", eixo: "Plano de ação", titulo: `Apenas ${pct(regs.length - semPlano.length, regs.length)}% dos sinistros têm plano de ação`, leitura: `${semPlano.length} de ${regs.length} sinistros ainda sem plano completo.`, evidencias: [], acao: "Definir prazo máximo de 7 dias após o sinistro para cadastrar o plano, com o coordenador como responsável." });
  }
  const concl = ligadas.filter((x) => x.sit === "CONCLUIDO").length;
  if (ligadas.length >= 10 && pct(concl, ligadas.length) >= 85 && !atrasadas.length) {
    add({ id: "plano-ok", nivel: "positivo", eixo: "Plano de ação", titulo: `${pct(concl, ligadas.length)}% das ações do plano concluídas`, leitura: "A execução do plano está em dia. O próximo passo é verificar a eficácia: o mesmo tipo de evento voltou a ocorrer?", evidencias: [], acao: "Medir a eficácia das ações concluídas em 60 e 90 dias." });
  }
  // reincidência da família mesmo com ação concluída
  const reincFam = prioridades.filter((p) => p.eventos >= 4).map((p) => p.familia);
  if (concl >= 5 && reincFam.length) {
    add({ id: "eficacia", nivel: "oportunidade", eixo: "Plano de ação", titulo: "Eventos repetidos mesmo com ações concluídas", leitura: `${lista(reincFam)} continuam aparecendo apesar das ações já executadas. Ação de divulgação e DDS isoladas raramente mudam o resultado.`, evidencias: [], acao: "Trocar parte das ações de comportamento (divulgação, orientação) por controles de engenharia, procedimento e verificação em campo." });
  }

  /* ---------- Taxas ---------- */
  try {
    const serie = serieTaxas(d, ano, true).filter((t) => t.tfca != null || t.tf != null);
    const u = serie[serie.length - 1];
    if (u && u.origem === "calculada") {
      if (u.tg != null && u.tg > u.metaTg) {
        add({ id: "tg", nivel: "critico", eixo: "Taxas", titulo: `Taxa de gravidade (TG) acima da meta: ${u.tg.toFixed(0)} contra ${u.metaTg}`, leitura: "A TG pesa o tempo perdido. Casos graves e fatais explicam quase todo o desvio.", evidencias: [`Acumulado até ${nomeMes[u.mes - 1]}`], acao: "Foco em evitar lesão grave: potencial de gravidade, controles críticos e acompanhamento dos afastados para retorno seguro." });
      } else if (u.tg != null) {
        add({ id: "tg-ok", nivel: "positivo", eixo: "Taxas", titulo: `TG dentro da meta: ${u.tg.toFixed(0)} (meta ${u.metaTg})`, leitura: `Acumulado até ${nomeMes[u.mes - 1]}.`, evidencias: [], acao: "Manter o acompanhamento dos casos com afastamento e a verificação das ações." });
      }
      if (u.tf != null && u.tf > u.metaTf) {
        add({ id: "tf", nivel: "atencao", eixo: "Taxas", titulo: `TF acima da meta: ${u.tf.toFixed(2)} contra ${u.metaTf}`, leitura: "Frequência de eventos sem afastamento acima do esperado: é o melhor indicador antecedente das lesões mais graves.", evidencias: [`Acumulado até ${nomeMes[u.mes - 1]}`], acao: "Atacar a frequência pelas famílias mais recorrentes e pelas equipes reincidentes." });
      }
    }
  } catch {
    /* sem horas-homem: ignora */
  }

  ins.sort((a, b) => PESO_NIVEL[a.nivel] - PESO_NIVEL[b.nivel]);

  /* ---------- resumo executivo ---------- */
  const resumo: string[] = [];
  if (regs.length) {
    resumo.push(`Em ${ano} foram ${regs.length} sinistro(s)${anterior.length ? `, ${regs.length >= anterior.length ? "+" : "-"}${Math.abs(regs.length - anterior.length)} em relação ao mesmo período de ${ano - 1}` : ""}; ${graves.length} com afastamento ou fatal.`);
    if (prioridades[0]) resumo.push(`A maior frente de redução de risco é ${prioridades[0].familia.toLowerCase()} (${prioridades[0].parte}% do risco ponderado).`);
    const critic = ins.filter((i) => i.nivel === "critico").length;
    resumo.push(critic ? `${critic} ponto(s) crítico(s) pedem decisão imediata; veja os insights abaixo.` : "Nenhum ponto crítico identificado; priorize as oportunidades abaixo.");
  } else {
    resumo.push(`Ainda não há sinistros registrados em ${ano}.`);
  }

  return { ano, mesAtual: mesLimite, regs, anterior, total: regs.length, totalAnt: anterior.length, graves: graves.length, gravesAnt: gravesAnt.length, fatais: fatais.length, semAfast: semAfast.length, riscoTotal, prioridades, porMesRisco, insights: ins, resumo };
}
