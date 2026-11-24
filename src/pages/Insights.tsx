import { useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertOctagon, AlertTriangle, CheckCircle2, Lightbulb, Target } from "lucide-react";
import { useData } from "../lib/store";
import { useTheme } from "../lib/theme";
import { Card, ChartTip, Chips, Empty } from "../components/ui";
import { MESES } from "../types";
import { COR_NIVEL, RECOMENDACAO, ROTULO_NIVEL, analisar, type Insight, type Nivel } from "../lib/insights";
import { Grad } from "./Dashboard";
import Info, { type Ajuda } from "../components/Info";

/** Explicações de cada bloco da tela: como ler e por que a informação importa para a decisão. */
const AJUDA: Record<string, Ajuda> = {
  resumo: {
    como: "Três frases geradas dos dados do ano: o total de sinistros e a comparação com o mesmo período do ano anterior, a família de tipologia com mais risco e quantos pontos críticos pedem decisão.",
    porque: "É a leitura de 30 segundos para a diretoria: mostra se a situação melhorou ou piorou e onde concentrar o esforço.",
  },
  kpiTotal: {
    como: "Quantidade de sinistros registrados no ano. A linha de baixo compara com o mesmo período do ano anterior (janeiro até o mês atual), para a comparação ser justa.",
    porque: "Mostra a tendência de frequência. Frequência alta hoje costuma anteceder lesões graves amanhã, por isso é o indicador mais cedo de alerta.",
  },
  kpiGraves: {
    como: "Sinistros com lesão que gerou afastamento mais os fatais. O número de baixo traz o do mesmo período do ano anterior.",
    porque: "É o que mais pesa nas taxas TFCA e TG e no custo humano. Reduzir a gravidade é o objetivo central: poucos eventos graves explicam a maior parte do risco.",
  },
  kpiFatais: {
    como: "Quantidade de fatalidades no ano. Verde quando é zero, vermelho quando há ocorrência.",
    porque: "Qualquer fatalidade exige ação imediata e a verificação do mesmo cenário em outras frentes. É o resultado que a empresa não pode aceitar.",
  },
  kpiFrente: {
    como: "Percentual do risco ponderado do ano que está na família de tipologia que mais pesa, com o nome da família abaixo.",
    porque: "Indica onde uma única ação gera a maior redução de risco. Priorizar poucas famílias é mais eficiente do que espalhar esforço por todas.",
  },
  kpiCriticos: {
    como: "Quantidade de insights de nível Crítico. Embaixo aparecem quantos são de Atenção e quantas são oportunidades.",
    porque: "Os críticos pedem decisão imediata. Atenção e oportunidades podem entrar no planejamento do mês.",
  },
  risco: {
    como: "Cada barra é uma família de tipologia. O comprimento mostra o risco ponderado, o número à direita é a parte dela no risco total do ano, e abaixo do nome ficam os eventos e quantos foram graves. O peso é: fatal 100, afastamento 25 mais os dias perdidos, sem afastamento 3 e incidente 1.",
    porque: "Contar eventos trata uma queda com afastamento igual a um incidente sem lesão. Ponderar pela gravidade aponta o que realmente precisa ser reduzido, que é o objetivo do trabalho.",
  },
  evolucao: {
    como: "As barras mostram o número de sinistros de cada mês. A linha amarela mostra o risco ponderado: ela sobe quando o mês teve eventos graves, mesmo que o número de eventos seja baixo.",
    porque: "Separa meses de muitos eventos leves de meses de poucos eventos graves. Picos da linha apontam os meses para investigar causa e sazonalidade.",
  },
  nivel: {
    como: "Crítico: exige decisão imediata. Atenção: tendência ou concentração que pode piorar. Oportunidade: ganho possível com ajuste simples. Ponto positivo: o que está funcionando e deve ser mantido.",
    porque: "Ordena a fila de decisão: resolva os críticos primeiro e use os demais para o planejamento.",
  },
  reco: {
    como: "Boas práticas de gestão para cada família de tipologia que apareceu nos sinistros do ano. Aparecem só as famílias com ocorrência.",
    porque: "Liga o diagnóstico à ação: depois de saber onde está o risco, indica por onde começar o plano de ação.",
  },
};

const eixoAjuda: Record<string, string> = {
  Gravidade: "Gravidade diz o quanto o evento custou em lesão. Reduzir gravidade é mais importante do que reduzir só o número de eventos.",
  Tipologia: "Tipologia é o tipo de ocorrência (trânsito, eletricidade, queda…). Agir por tipologia ataca a causa que se repete.",
  Tendência: "Tendência compara períodos. Mostra se a situação melhora ou piora e o que mudou.",
  "Onde e quando": "Localiza o risco por base, gerência, equipe, pessoa, dia e turno, para direcionar a liderança de campo.",
  "Plano de ação": "Mede se as ações corretivas existem, estão em dia e funcionam. Sem execução, o evento tende a se repetir.",
  Taxas: "As taxas TF, TFCA e TG comparam a empresa com a meta, considerando as horas trabalhadas.",
};

/** Explicação de cada insight, por tipo. */
function ajudaDoInsight(i: Insight): Ajuda {
  const id = i.id;
  const mapa: [RegExp, Ajuda][] = [
    [/^fatal$/, { como: "Lista as fatalidades do ano com data, base e característica.", porque: "Uma fatalidade indica falha grave de controle. O aprendizado precisa chegar a todas as bases com a mesma atividade." }],
    [/^graves$/, { como: "Conta os sinistros com afastamento e fatais, mostra quanto do risco eles concentram e em quais famílias estão.", porque: "Poucos eventos graves explicam grande parte do risco e dos dias perdidos. É nesse grupo que a redução de gravidade acontece." }],
    [/^sem-graves$/, { como: "Aparece quando o ano não tem nenhum sinistro com afastamento ou fatal.", porque: "É um bom resultado, mas eventos de alto potencial ainda podem esconder a próxima ocorrência grave." }],
    [/^potencial$/, { como: "Mostra eventos de choque elétrico e queda que não geraram lesão grave, mas poderiam ter gerado.", porque: "Pela pirâmide de segurança, quase-acidentes graves são o melhor aviso antecipado. Investigá-los evita a fatalidade que viria depois." }],
    [/^pareto$/, { como: "Mostra a família de tipologia que concentra mais risco e a soma das três maiores (princípio de Pareto: poucas causas, grande parte do efeito).", porque: "Define onde investir primeiro. Se uma família passa de 35% a 50% do risco, ela merece um programa próprio." }],
    [/^fam-/, { como: "Segunda ou terceira família de maior risco ponderado do ano.", porque: "Depois da principal, é a próxima frente que mais reduz risco se for tratada." }],
    [/^carac$/, { como: "Conta os registros sem característica preenchida.", porque: "Sem característica não dá para priorizar a causa nem recomendar controles." }],
    [/^tendencia$/, { como: "Compara o total de sinistros de janeiro até o mês atual com o mesmo período do ano passado.", porque: "Responde se estamos melhorando. Comparar períodos iguais evita conclusões erradas por sazonalidade." }],
    [/^cresc$/, { como: "Mostra a família que mais cresceu em relação ao mesmo período do ano anterior (de X para Y eventos).", porque: "Crescimento de uma família indica uma causa nova ou piorada. Agir cedo evita que vire padrão." }],
    [/^tri$/, { como: "Compara os 3 últimos meses com os 3 meses anteriores.", porque: "Aceleração recente pede reação rápida, antes que o trimestre feche acima do esperado." }],
    [/^base$/, { como: "Mostra a base com mais de 28% dos sinistros e as famílias que ocorrem nela.", porque: "Concentração em uma base aponta problema local (supervisão, equipe, rota) e permite direcionar a liderança." }],
    [/^ger$/, { como: "Mostra a gerência que responde por quase metade dos eventos.", porque: "Permite cobrar um plano de redução do dono do risco, com metas por base." }],
    [/^reinc$/, { como: "Lista colaboradores com mais de um sinistro no ano.", porque: "Reincidência indica falta de aderência a procedimento, treinamento insuficiente ou exposição maior. Acompanhamento individual reduz repetição." }],
    [/^equipes$/, { como: "Lista prefixos de equipe com 3 ou mais sinistros no ano.", porque: "Equipes que se repetem indicam um padrão de composição, veículo, tipo de serviço ou supervisão a ser auditado." }],
    [/^dia$/, { como: "Mostra o dia da semana com maior concentração de sinistros.", porque: "Permite reforçar o DDS e a presença de campo no dia mais crítico." }],
    [/^turno$/, { como: "Mostra o turno com a maior parte dos eventos (considera só os registros com turno informado).", porque: "Indica onde concentrar a liderança e as inspeções ao longo do dia." }],
    [/^trajeto$/, { como: "Conta sinistros no deslocamento casa-trabalho.", porque: "Não entram nas taxas, mas geram afastamento e custo. Pedem campanha de condução segura e controle de fadiga." }],
    [/^terceiros$/, { como: "Mostra a parcela de sinistros em que terceiros estão envolvidos.", porque: "Quando o terceiro é a causa, a redução vem de exposição e condução defensiva, não só de conduta interna." }],
    [/^graves-sem-plano$/, { como: "Lista sinistros graves ou fatais ainda sem ação completa no relatório de Plano de Ação.", porque: "É o controle que impede a repetição. Sinistro grave sem plano é risco aberto." }],
    [/^atrasadas$/, { como: "Conta ações do plano com prazo vencido e mostra quem tem mais atrasos.", porque: "Ação atrasada é controle que continua desativado. Cobrança semanal e escalonamento mantêm o plano vivo." }],
    [/^cobertura$/, { como: "Percentual de sinistros do ano que já têm plano de ação completo.", porque: "Todo sinistro deve ter plano. Cobertura baixa significa causas sem tratamento." }],
    [/^plano-ok$/, { como: "Aparece quando mais de 85% das ações estão concluídas e nenhuma está atrasada.", porque: "Execução em dia é pré-requisito. O próximo passo é medir a eficácia: o evento voltou?" }],
    [/^eficacia$/, { como: "Aponta famílias que continuam aparecendo mesmo com ações já concluídas.", porque: "Ações só de divulgação e orientação raramente mudam o resultado. É sinal para trocar por controles de engenharia e verificação em campo." }],
    [/^tg/, { como: "Compara a taxa de gravidade acumulada do ano com a meta (NBR 14280).", porque: "A TG pesa o tempo perdido. Casos graves e fatais explicam quase todo o desvio." }],
    [/^tf$/, { como: "Compara a taxa de frequência sem afastamento com a meta.", porque: "É um indicador antecedente: frequência alta precede lesões mais graves." }],
  ];
  const achou = mapa.find(([re]) => re.test(id));
  return achou ? achou[1] : { como: i.leitura, porque: eixoAjuda[i.eixo] ?? "" };
}

const ICONE: Record<Nivel, typeof Target> = { critico: AlertOctagon, atencao: AlertTriangle, oportunidade: Lightbulb, positivo: CheckCircle2 };
const NIVEIS: Nivel[] = ["critico", "atencao", "oportunidade", "positivo"];

function CartaoInsight({ i, aberto, onToggle }: { i: Insight; aberto: boolean; onToggle: () => void }) {
  const Icone = ICONE[i.nivel];
  const cor = COR_NIVEL[i.nivel];
  return (
    <article className="insight" style={{ ["--c" as string]: cor }}>
      <button type="button" className="insight-cab" onClick={onToggle} aria-expanded={aberto}>
        <span className="insight-ico"><Icone size={18} /></span>
        <span className="insight-tit">
          <small>{i.eixo} · {ROTULO_NIVEL[i.nivel]}</small>
          <b>{i.titulo}</b>
        </span>
        <span className="insight-seta" aria-hidden>{aberto ? "−" : "+"}</span>
      </button>
      <span className="insight-info"><Info titulo={i.titulo} ajuda={ajudaDoInsight(i)} /></span>
      <p className="insight-leitura">{i.leitura}</p>
      {aberto && (
        <div className="insight-corpo">
          {i.evidencias.length > 0 && (
            <ul className="insight-evid">
              {i.evidencias.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}
          <div className="insight-acao"><Target size={15} /><div><small>O que fazer</small><p>{i.acao}</p></div></div>
        </div>
      )}
    </article>
  );
}

export default function Insights() {
  const { data } = useData();
  const { c } = useTheme();
  const anos = useMemo(() => [...new Set([...data.registros.filter((r) => r.categoria === "acidente").map((r) => Number(r.data.slice(0, 4))), new Date().getFullYear()])].sort(), [data.registros]);
  const [ano, setAno] = useState(() => new Date().getFullYear());
  const [nivel, setNivel] = useState<Nivel | "todos">("todos");
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const a = useMemo(() => analisar(data, ano), [data, ano]);
  const visiveis = a.insights.filter((i) => nivel === "todos" || i.nivel === nivel);
  const cont = (n: Nivel) => a.insights.filter((i) => i.nivel === n).length;
  const alterna = (id: string) => setAbertos((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const axis = { fontSize: 12, fill: c.text };
  const variacao = a.totalAnt ? Math.round(((a.total - a.totalAnt) / a.totalAnt) * 100) : null;
  const maxRisco = Math.max(1, ...a.prioridades.map((p) => p.risco));

  return (
    <>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <Chips options={anos} selected={[ano]} onToggle={(v) => setAno(v)} />
        <div className="grow" />
        <button className="btn" onClick={() => setAbertos(abertos.size ? new Set() : new Set(visiveis.map((i) => i.id)))}>{abertos.size ? "Recolher todos" : "Expandir todos"}</button>
      </div>

      <section className="insight-hero">
        <div className="insight-hero-ico"><Lightbulb size={26} /></div>
        <div>
          <small>Resumo executivo · {ano} <Info titulo="Resumo executivo" ajuda={AJUDA.resumo} /></small>
          <h2>Onde agir para reduzir sinistros por gravidade e tipologia</h2>
          <ul>{a.resumo.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      </section>

      <div className="ndgs-kpis">
        {[
          { k: "kpiTotal", r: "Sinistros no ano", v: a.total, cor: "var(--line)", s: variacao == null ? "sem base de comparação" : `${variacao > 0 ? "+" : ""}${variacao}% vs ${ano - 1} (mesmo período)` },
          { k: "kpiGraves", r: "Com afastamento ou fatal", v: a.graves, cor: a.graves ? "#e0566f" : "#22b45f", s: a.gravesAnt ? `${a.gravesAnt} no mesmo período de ${ano - 1}` : "foco da redução de gravidade" },
          { k: "kpiFatais", r: "Fatais", v: a.fatais, cor: a.fatais ? "#e0566f" : "#22b45f", s: a.fatais ? "exigem ação imediata" : "nenhum no período" },
          { k: "kpiFrente", r: "Maior frente de risco", v: a.prioridades[0] ? `${a.prioridades[0].parte}%` : "—", cor: "#f2b01e", s: a.prioridades[0]?.familia ?? "sem dados" },
          { k: "kpiCriticos", r: "Pontos críticos", v: cont("critico"), cor: cont("critico") ? "#e0566f" : "#22b45f", s: `${cont("atencao")} de atenção · ${cont("oportunidade")} oportunidades` },
        ].map((k) => (
          <div key={k.r} className="ndgs-kpi" style={{ ["--c" as string]: k.cor }}>
            <small className="kpi-rot">{k.r}<Info titulo={k.r} ajuda={AJUDA[k.k]} tamanho={14} /></small>
            <b>{k.v}</b>
            <small>{k.s}</small>
          </div>
        ))}
      </div>

      <div className="grid">
        <Card title="Onde está o risco: tipologia ponderada pela gravidade" extra={<span className="extra-info">fatal e afastamento pesam mais que contagem<Info titulo="Risco ponderado por tipologia" ajuda={AJUDA.risco} /></span>} className="s7">
          {a.prioridades.length ? (
            <div className="prior">
              {a.prioridades.map((p, i) => (
                <div key={p.familia} className="prior-linha">
                  <span className="pos">{i + 1}º</span>
                  <div className="meio">
                    <div className="topo"><b>{p.familia}</b><small>{p.eventos} evento(s){p.graves ? ` · ${p.graves} grave(s)` : ""}</small></div>
                    <div className="barra"><i style={{ width: `${(p.risco / maxRisco) * 100}%` }} /></div>
                  </div>
                  <span className="pct">{p.parte}%</span>
                </div>
              ))}
              <small className="prior-nota">Pontuação: fatal 100 · com afastamento 25 + dias perdidos · sem afastamento 3 · incidente 1.</small>
            </div>
          ) : (
            <Empty />
          )}
        </Card>

        <Card title="Evolução mensal: eventos e risco ponderado" extra={<Info titulo="Evolução mensal" ajuda={AJUDA.evolucao} />} className="s5">
          {a.total ? (
            <div style={{ height: 270 }}>
              <ResponsiveContainer>
                <ComposedChart data={a.porMesRisco.filter((m) => m.mes <= Math.max(a.mesAtual, 1)).map((m) => ({ ...m, nome: MESES[m.mes - 1] }))} margin={{ top: 26, right: 8, left: -18, bottom: 0 }}>
                  <defs><Grad id="ins-b" color={c.bar} /></defs>
                  <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="3 5" />
                  <XAxis dataKey="nome" tick={axis} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="e" hide allowDecimals={false} domain={[0, (m: number) => Math.ceil(m * 1.15)]} />
                  <YAxis yAxisId="r" orientation="right" hide domain={[0, (m: number) => Math.ceil(m * 1.2)]} />
                  <Tooltip cursor={{ fill: c.cursor, radius: 8 }} wrapperStyle={{ zIndex: 20 }} content={<ChartTip />} />
                  <Bar yAxisId="e" dataKey="eventos" name="Eventos" fill="url(#ins-b)" radius={[7, 7, 0, 0]} maxBarSize={30} isAnimationActive={false}>
                    <LabelList dataKey="eventos" position="insideBottom" offset={6} fill="#ffffff" fontSize={12} fontWeight={700} formatter={(v: unknown) => (Number(v) ? String(v) : "")} />
                  </Bar>
                  <Line yAxisId="r" type="monotone" dataKey="risco" name="Risco ponderado" stroke="#f2b01e" strokeWidth={3} dot={{ r: 3 }} isAnimationActive={false}>
                    <LabelList dataKey="risco" position="top" offset={9} fill="#f2b01e" fontSize={11} fontWeight={700} formatter={(v: unknown) => (Number(v) ? String(v) : "")} />
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty />
          )}
          <div className="legend"><span className="leg-item" style={{ cursor: "default" }}><i style={{ background: c.bar }} />Eventos</span><span className="leg-item" style={{ cursor: "default" }}><i style={{ background: "#f2b01e" }} />Risco ponderado</span></div>
        </Card>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "22px 0 14px" }}>
      <div className="seg" role="group" aria-label="Filtrar insights por nível" style={{ flexWrap: "wrap" }}>
        <button className={nivel === "todos" ? "on" : ""} onClick={() => setNivel("todos")}>Todos ({a.insights.length})</button>
        {NIVEIS.map((n) => <button key={n} className={nivel === n ? "on" : ""} onClick={() => setNivel(n)} disabled={!cont(n)}>{ROTULO_NIVEL[n]} ({cont(n)})</button>)}
      </div>
      <Info titulo="Níveis dos insights" ajuda={AJUDA.nivel} />
      </div>

      {visiveis.length ? (
        <div className="insights-lista">
          {visiveis.map((i) => <CartaoInsight key={i.id} i={i} aberto={abertos.has(i.id)} onToggle={() => alterna(i.id)} />)}
        </div>
      ) : (
        <Card><Empty /></Card>
      )}

      <Card title="Recomendações por tipologia" extra={<span className="extra-info">boas práticas para reduzir cada família<Info titulo="Recomendações por tipologia" ajuda={AJUDA.reco} /></span>} className="s12">
        <div className="reco-grid">
          {Object.entries(RECOMENDACAO).filter(([k]) => a.prioridades.some((p) => p.familia === k)).map(([k, v]) => (
            <div key={k} className="reco">
              <b>{k}</b>
              <p>{v}</p>
            </div>
          ))}
        </div>
        <p className="hint-inline" style={{ marginTop: 12 }}>Os insights são gerados automaticamente a partir dos sinistros, das taxas e do plano de ação. Servem de apoio à decisão e não substituem a análise de causa raiz de cada evento.</p>
      </Card>
    </>
  );
}
