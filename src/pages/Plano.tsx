import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Check, Download, FileUp, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useData } from "../lib/store";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { fmtData } from "../lib/stats";
import { Card, ChartTip, Chips, Empty, Toast } from "../components/ui";
import { BASES, MESES, type AcaoPlano, type Registro, type SituacaoAcao, type TipoPlano } from "../types";
import { COR_SIT, ROTULO_SIT, SITUACOES, chaveAcao, completa, faltando, hojeISO, lerPlanilha, novoIdAcao, situacaoEfetiva, sinistroDa, ROTULO_TIPO, TIPOS_PLANO, tipoDe } from "../lib/plano";

type Linha = { a: AcaoPlano; s?: Registro; sit: SituacaoAcao };
type Filtro = "todas" | SituacaoAcao;
/** Linha da tabela de sinistros sem plano: o sinistro e/ou um plano ainda incompleto. */
type SemLinha = { s?: Registro; rasc?: AcaoPlano };

const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: "todas", rotulo: "Todas" },
  { id: "CONCLUIDO", rotulo: "Concluídas" },
  { id: "EM ANDAMENTO", rotulo: "Em andamento" },
  { id: "PENDENTE", rotulo: "Pendentes" },
  { id: "ATRASADO", rotulo: "Atrasadas" },
];

/** Dica de gráfico: título, linhas com cor e uma linha final opcional (total). */
function Dica({ active, titulo, linhas, rodape }: { active?: boolean; titulo?: string; linhas: { cor: string; nome: string; valor: string }[]; rodape?: string }) {
  if (!active || !linhas.length) return null;
  return (
    <div className="tip">
      {titulo && <b>{titulo}</b>}
      {linhas.map((l) => (
        <div key={l.nome}>
          <i style={{ background: l.cor }} />
          <span>{l.nome}</span>
          <strong>{l.valor}</strong>
        </div>
      ))}
      {rodape && <div style={{ opacity: 0.85 }}><span>{rodape}</span></div>}
    </div>
  );
}

/** Formulário do plano de ação: a ação só entra no plano quando todos os campos obrigatórios estão preenchidos. */
function FormAcao({ inicial, novo, areas, onSalvar, onExcluir, onFechar }: { inicial: AcaoPlano; novo: boolean; areas: string[]; onSalvar: (a: AcaoPlano, outra: boolean) => Promise<void>; onExcluir?: () => void; onFechar: () => void }) {
  const [f, setF] = useState<AcaoPlano>(inicial);
  const [salvando, setSalvando] = useState(false);
  const set = <K extends keyof AcaoPlano>(k: K, v: AcaoPlano[K]) => setF((x) => ({ ...x, [k]: v }));
  const falta = faltando(f);
  const vazio = (rotulo: string) => falta.includes(rotulo) && <span className="err">Obrigatório</span>;

  async function enviar(outra: boolean) {
    if (falta.length || salvando) return;
    setSalvando(true);
    const m = { ...f, concluidoEm: f.situacao === "CONCLUIDO" ? f.concluidoEm || hojeISO() : null };
    await onSalvar(m, outra);
    setSalvando(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    void enviar(false);
  }

  return (
    <div className="overlay center" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <form className="modal" onSubmit={submit} role="dialog" aria-modal="true" aria-label="Plano de ação">
        <div className="modal-head">
          <h2>{novo ? "Novo plano de ação" : "Completar plano de ação"}</h2>
          <button type="button" className="icon-btn" onClick={onFechar} aria-label="Fechar"><X size={20} /></button>
        </div>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>Preencha todos os campos: a ação só sobe para a tabela "Plano de ação dos sinistros" quando estiver completa. Um sinistro pode ter quantas ações forem necessárias.</p>
        <div className="form-grid">
          <div className="field"><label>Data do evento</label><input className="input" type="date" value={f.dataEvento} onChange={(e) => set("dataEvento", e.target.value)} /></div>
          <div className="field"><label>Tipo do plano *</label>
            <select className="select" value={tipoDe(f)} onChange={(e) => set("tipo", e.target.value as TipoPlano)}>
              {TIPOS_PLANO.map((t) => <option key={t} value={t}>{ROTULO_TIPO[t]}</option>)}
            </select>
          </div>
          <div className="field"><label>Nome *</label><input className="input" value={f.nome} onChange={(e) => set("nome", e.target.value)} />{vazio("Nome")}</div>
          <div className="field"><label>Áreas de controle *</label><input className="input" list="plano-areas-form" value={f.area} onChange={(e) => set("area", e.target.value)} placeholder="Ex.: Ação de controle" />{vazio("Áreas de controle")}<datalist id="plano-areas-form">{areas.map((a) => <option key={a} value={a} />)}</datalist></div>
          <div className="field"><label>Base *</label>
            <select className="select" value={f.base} onChange={(e) => set("base", e.target.value)}>
              <option value="">Escolha</option>
              {BASES.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            {vazio("Base")}
          </div>
          <div className="field full"><label>Ação de melhoria *</label><textarea className="input" rows={4} value={f.acao} onChange={(e) => set("acao", e.target.value)} style={{ resize: "vertical" }} />{vazio("Ação de melhoria")}</div>
          <div className="field"><label>Responsável pela execução *</label><input className="input" value={f.responsavel} onChange={(e) => set("responsavel", e.target.value)} placeholder="Nome (função)" />{vazio("Responsável pela execução")}</div>
          <div className="field"><label>Prazo de conclusão *</label><input className="input" type="date" value={f.prazo ?? ""} onChange={(e) => set("prazo", e.target.value || null)} />{vazio("Prazo de conclusão")}</div>
          <div className="field"><label>Situação atual</label>
            <select className="select" value={f.situacao === "ATRASADO" ? "EM ANDAMENTO" : f.situacao} onChange={(e) => set("situacao", e.target.value as SituacaoAcao)}>
              {(["PENDENTE", "EM ANDAMENTO", "CONCLUIDO"] as SituacaoAcao[]).map((x) => <option key={x} value={x}>{ROTULO_SIT[x]}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn primary" disabled={!!falta.length || salvando}>{salvando ? "Salvando…" : "Incluir no plano de ação"}</button>
          <button type="button" className="btn" disabled={!!falta.length || salvando} onClick={() => void enviar(true)}><Plus size={14} /> Incluir e adicionar outra ação</button>
          <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
          {onExcluir && <button type="button" className="btn" onClick={onExcluir}><Trash2 size={14} /> Descartar rascunho</button>}
          <small style={{ color: falta.length ? "var(--bad)" : "var(--muted)" }}>{falta.length ? `Faltam: ${falta.join(", ")}` : "Tudo preenchido."}</small>
        </div>
      </form>
    </div>
  );
}

const Selo = ({ sit }: { sit: SituacaoAcao }) => (
  <span className="badge" style={{ background: COR_SIT[sit] + "33", color: COR_SIT[sit], fontWeight: 700, whiteSpace: "nowrap" }}>{ROTULO_SIT[sit]}</span>
);

/** Número da fatia dentro do anel, com cor de texto que contrasta com a fatia. */
const rotuloFatia = (p: { cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; value: number; sit?: SituacaoAcao; payload?: { sit: SituacaoAcao } }) => {
  const rad = Math.PI / 180;
  const r = (p.innerRadius + p.outerRadius) / 2;
  const sit = p.payload?.sit ?? p.sit ?? "CONCLUIDO";
  return (
    <text x={p.cx + r * Math.cos(-p.midAngle * rad)} y={p.cy + r * Math.sin(-p.midAngle * rad)} textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={700} fill={sit === "EM ANDAMENTO" ? "#1d1a1f" : "#ffffff"} style={{ pointerEvents: "none" }}>
      {p.value}
    </text>
  );
};

export default function Plano() {
  const { data, setAcoes, removeAcao } = useData();
  const { admin } = useAuth();
  const { c } = useTheme();
  const acoes = data.acoes ?? [];
  const hoje = hojeISO();
  const hojeAno = Number(hoje.slice(0, 4));

  const anos = useMemo(() => [...new Set([...acoes.map((a) => Number(a.dataEvento.slice(0, 4))), ...data.registros.filter((r) => r.categoria === "acidente").map((r) => Number(r.data.slice(0, 4))), hojeAno])].filter(Boolean).sort(), [acoes, data.registros, hojeAno]);
  const [ano, setAno] = useState(hojeAno);
  const iniciou = useRef(false);
  useEffect(() => {
    if (iniciou.current || !acoes.length) return;
    iniciou.current = true;
    setAno(Math.max(...acoes.map((a) => Number(a.dataEvento.slice(0, 4)))));
  }, [acoes]);

  const [base, setBase] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [toast, setToast] = useState("");
  const [lote, setLote] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  const [rascunho, setRascunho] = useState<Record<string, Partial<AcaoPlano>>>({});
  useEffect(() => setRascunho({}), [ano]);

  // sinistros do ano e ações ligadas a eles
  const sinistros = useMemo(() => data.registros.filter((r) => r.categoria === "acidente" && r.data.startsWith(String(ano))), [data.registros, ano]);
  const doAno = useMemo(() => acoes.filter((a) => a.dataEvento.startsWith(String(ano))), [acoes, ano]);
  // só entram no plano as ações com todos os campos preenchidos; as demais ficam na tabela de sinistros sem plano
  const ligadasTodas = useMemo(() => doAno.filter(completa).map((a) => ({ a, s: sinistroDa(a, sinistros), sit: situacaoEfetiva(a, hoje) })), [doAno, sinistros, hoje]);
  const [tipoF, setTipoF] = useState<"" | TipoPlano>("");
  const ligadas = useMemo(() => ligadasTodas.filter((x) => !tipoF || tipoDe(x.a) === tipoF), [ligadasTodas, tipoF]);
  const semPlano = useMemo<SemLinha[]>(() => {
    const com = new Set(ligadasTodas.map((x) => x.s?.id).filter(Boolean));
    const rasc = doAno.filter((a) => !completa(a)).map((a) => ({ a, s: sinistroDa(a, sinistros) }));
    const usados = new Set<string>();
    const dos: SemLinha[] = [];
    for (const s of sinistros.filter((y) => !com.has(y.id))) {
      const rascs = rasc.filter((y) => y.s?.id === s.id);
      if (!rascs.length) dos.push({ s });
      for (const y of rascs) {
        usados.add(y.a.id);
        dos.push({ s, rasc: y.a });
      }
    }
    const resto: SemLinha[] = rasc.filter((x) => !usados.has(x.a.id)).map((x) => ({ s: x.s, rasc: x.a }));
    return [...dos, ...resto];
  }, [ligadasTodas, doAno, sinistros]);

  // cartões e rosca seguem a base escolhida; o gráfico por base segue a situação escolhida
  const ligBase = useMemo(() => ligadas.filter((x) => !base || x.a.base === base), [ligadas, base]);
  const ligSit = useMemo(() => ligadas.filter((x) => filtro === "todas" || x.sit === filtro), [ligadas, filtro]);
  const baseDe = (l: SemLinha) => l.s?.base ?? l.rasc?.base ?? "";
  const dataDe = (l: SemLinha) => l.s?.data ?? l.rasc?.dataEvento ?? "";
  const nomeDe = (l: SemLinha) => l.s?.colaborador ?? l.rasc?.nome ?? "";
  const semBase = useMemo(() => semPlano.filter((l) => !base || baseDe(l) === base), [semPlano, base]);
  const cont = (sit: SituacaoAcao) => ligBase.filter((x) => x.sit === sit).length;
  const total = ligBase.length;
  const concluidas = cont("CONCLUIDO");
  const pctConcl = total ? Math.round((concluidas / total) * 100) : 0;
  const alterarFiltro = (f: Filtro) => setFiltro((atual) => (atual === f ? "todas" : f));

  const donut = SITUACOES.map((s) => ({ name: ROTULO_SIT[s], value: cont(s), sit: s })).filter((d) => d.value > 0);
  const porBase = useMemo(() => {
    const bases = [...new Set([...BASES, ...ligadas.map((x) => x.a.base).filter(Boolean)])];
    return bases
      .map((b) => {
        const por = Object.fromEntries(SITUACOES.map((s) => [s, ligSit.filter((x) => x.a.base === b && x.sit === s).length])) as Record<SituacaoAcao, number>;
        return { base: b, ...por, total: SITUACOES.reduce((t, s) => t + por[s], 0), topo: 0.001 } as Record<string, number | string>;
      })
      .filter((d) => (d.total as number) > 0)
      .sort((a, b) => (b.total as number) - (a.total as number) || String(a.base).localeCompare(String(b.base)));
  }, [ligadas, ligSit]);

  const [busca, setBusca] = useState("");
  const chaveSinistro = (a: AcaoPlano, s?: Registro) => s?.id ?? `${a.dataEvento}|${a.nome}`;
  const acoesPorSinistro = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of ligadas) m.set(chaveSinistro(x.a, x.s), (m.get(chaveSinistro(x.a, x.s)) ?? 0) + 1);
    return m;
  }, [ligadas]);
  const semAcento = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const linhas = useMemo<Linha[]>(() => {
    const t = semAcento(busca.trim());
    return ligadas
      .filter((x) => (!base || x.a.base === base) && (filtro === "todas" || x.sit === filtro))
      .filter((x) => !t || semAcento([x.a.nome, x.a.responsavel].join(" ")).includes(t))
      .sort((a, b) => b.a.dataEvento.localeCompare(a.a.dataEvento) || a.a.nome.localeCompare(b.a.nome));
  }, [ligadas, base, filtro, busca]);

  // sinistros sem plano de ação: tabela própria, com filtros próprios
  const [sBase, setSBase] = useState("");
  const [sMes, setSMes] = useState("");
  const [sBusca, setSBusca] = useState("");
  const semFiltrados = useMemo(() => {
    const t = sBusca.trim().toLowerCase();
    return semPlano
      .filter((l) => (!(sBase || base) || baseDe(l) === (sBase || base)) && (!sMes || dataDe(l).slice(5, 7) === sMes))
      .filter((l) => !t || [nomeDe(l), l.s?.prefixo, l.s?.caracteristica, l.s?.tipo, l.s?.processo, l.rasc?.acao].join(" ").toLowerCase().includes(t))
      .sort((a, b) => dataDe(b).localeCompare(dataDe(a)));
  }, [semPlano, sBase, base, sMes, sBusca]);
  const mesesSem = useMemo(() => [...new Set(semPlano.map((l) => dataDe(l).slice(5, 7)))].filter(Boolean).sort(), [semPlano]);

  // formulário do plano (nova ação ou preenchimento de um plano incompleto)
  const [form, setForm] = useState<{ acao: AcaoPlano; novo: boolean } | null>(null);
  const abrirNova = (o: { registroId?: string | null; dataEvento: string; nome: string; base: string; tipo?: TipoPlano }) =>
    setForm({ novo: true, acao: { id: novoIdAcao(), registroId: o.registroId ?? null, dataEvento: o.dataEvento, nome: o.nome, area: "", acao: "", base: o.base, responsavel: "", prazo: null, situacao: "PENDENTE", tipo: o.tipo ?? "RIAI", concluidoEm: null } });
  const abrirLinha = (l: SemLinha) => {
    if (!admin) return;
    if (l.rasc) return setForm({ novo: false, acao: l.rasc });
    if (l.s) abrirNova({ registroId: l.s.id, dataEvento: l.s.data, nome: l.s.colaborador, base: l.s.base });
  };

  // posição de cada ação entre as do mesmo sinistro ("ação 2 de 3")
  const posicoes = useMemo(() => {
    const c = new Map<string, number>();
    return linhas.map((x) => {
      const k = chaveSinistro(x.a, x.s);
      const n = (c.get(k) ?? 0) + 1;
      c.set(k, n);
      return n;
    });
  }, [linhas]);
  const marca = (x: Linha, i: number) => {
    const n = acoesPorSinistro.get(chaveSinistro(x.a, x.s)) ?? 1;
    return n > 1 ? <small style={{ display: "block", color: "var(--muted)", marginTop: 4 }}>Ação {posicoes[i]} de {n} do sinistro</small> : null;
  };

  const valor = <K extends keyof AcaoPlano>(a: AcaoPlano, k: K): AcaoPlano[K] => (rascunho[a.id]?.[k] ?? a[k]) as AcaoPlano[K];
  const mudou = (a: AcaoPlano) => !!rascunho[a.id] && (Object.keys(rascunho[a.id]) as (keyof AcaoPlano)[]).some((k) => (rascunho[a.id][k] ?? "") !== (a[k] ?? ""));
  const editar = (a: AcaoPlano, parte: Partial<AcaoPlano>) => setRascunho((r) => ({ ...r, [a.id]: { ...r[a.id], ...parte } }));
  const pendentes = ligadas.map((x) => x.a).filter(mudou);

  const montar = (a: AcaoPlano, extra: Partial<AcaoPlano> = {}): AcaoPlano => {
    const m: AcaoPlano = { ...a, ...rascunho[a.id], ...extra };
    if (m.situacao === "CONCLUIDO") m.concluidoEm = m.concluidoEm || hoje;
    else m.concluidoEm = null;
    if (!m.prazo) m.prazo = null;
    return m;
  };

  async function salvar(lista: AcaoPlano[], msg: string) {
    const incompleta = lista.find((a) => !completa(a));
    if (incompleta) return setToast(`Preencha todos os campos antes de salvar: faltam ${faltando(incompleta).join(", ")}`);
    const e = await setAcoes(lista);
    if (e) return setToast(e);
    setRascunho((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !lista.some((a) => a.id === k))));
    setToast(msg);
  }

  async function incluir(a: AcaoPlano, outra: boolean) {
    const e = await setAcoes([a]);
    if (e) return setToast(e);
    if (outra) {
      abrirNova({ registroId: a.registroId, dataEvento: a.dataEvento, nome: a.nome, base: a.base, tipo: tipoDe(a) });
      setToast("Ação incluída no plano. Cadastre a próxima ação deste sinistro");
      return;
    }
    setForm(null);
    setToast("Ação incluída no plano de ação dos sinistros");
  }

  async function descartar(a: AcaoPlano) {
    if (!confirm("Descartar este plano incompleto?")) return;
    const e = await removeAcao(a.id);
    setForm(null);
    setToast(e ?? "Rascunho descartado");
  }

  async function excluir(a: AcaoPlano) {
    if (!confirm("Excluir esta ação do plano?")) return;
    const e = await removeAcao(a.id);
    setToast(e ?? "Ação excluída");
  }

  /** Exporta para Excel o que está na tela: ações do plano (com os filtros ativos) e sinistros sem plano completo. */
  async function exportar() {
    const X = await import("xlsx");
    const dt = (iso?: string | null) => (iso ? fmtData(iso) : "");
    const plano = linhas.map((x) => ({
      "DATA DO EVENTO": dt(x.a.dataEvento),
      NOME: x.a.nome,
      TIPO: ROTULO_TIPO[tipoDe(x.a)].toUpperCase(),
      "ÁREAS DE CONTROLE": x.a.area,
      "AÇÃO DE MELHORIAS": x.a.acao,
      BASE: x.a.base,
      "RESPONSÁVEL PELA EXECUÇÃO": x.a.responsavel,
      "DATA PREVISTA DE EXECUÇÃO (Conclusão)": dt(x.a.prazo),
      "SITUAÇÃO ATUAL": x.sit,
      "DATA DE CONCLUSÃO": dt(x.a.concluidoEm),
    }));
    const sem = semFiltrados.map((l) => ({
      "DATA DO EVENTO": dt(dataDe(l)),
      NOME: nomeDe(l),
      PREFIXO: l.s?.prefixo ?? "",
      GERÊNCIA: l.s?.processo ?? "",
      BASE: baseDe(l),
      CARACTERÍSTICA: l.s?.caracteristica || l.s?.tipo || "",
      "SITUAÇÃO DO PLANO": l.rasc ? `INCOMPLETO (faltam: ${faltando(l.rasc).join(", ")})` : "SEM PLANO",
    }));
    const wb = X.utils.book_new();
    const folha = (linhasXls: Record<string, string>[], larguras: number[]) => {
      const ws = X.utils.json_to_sheet(linhasXls);
      ws["!cols"] = larguras.map((wch) => ({ wch }));
      return ws;
    };
    X.utils.book_append_sheet(wb, folha(plano, [14, 34, 12, 30, 70, 8, 34, 20, 16, 16]), "Plano de Ação");
    X.utils.book_append_sheet(wb, folha(sem, [14, 34, 16, 12, 8, 50, 44]), "Sinistros sem plano");
    X.writeFile(wb, `plano-de-acao-${ano}.xlsx`);
    setToast(`Planilha exportada: ${plano.length} ação(ões) e ${sem.length} sinistro(s) sem plano`);
  }

  async function importar(f: File) {
    setOcupado(true);
    setLote("Lendo a planilha…");
    try {
      const X = await import("xlsx");
      const wb = X.read(await f.arrayBuffer());
      const grade = X.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
      const r = lerPlanilha(grade, X.SSF as never);
      if (!r) return setLote("Cabeçalho não encontrado. A planilha precisa das colunas DATA DO EVENTO, NOME, ÁREAS DE CONTROLE, AÇÃO DE MELHORIAS, BASE, RESPONSÁVEL, DATA PREVISTA e SITUAÇÃO ATUAL.");
      const existentes = new Set(acoes.map(chaveAcao));
      const novas = r.acoes.filter((a) => !existentes.has(chaveAcao(a)));
      const e = await setAcoes(novas);
      if (e) return setLote(e);
      setLote(`${novas.length} ação(ões) importada(s), ${r.acoes.length - novas.length} já existia(m)${r.ignoradas ? `, ${r.ignoradas} linha(s) ignorada(s) sem data ou ação` : ""}.`);
      if (novas.length) setAno(Math.max(...novas.map((a) => Number(a.dataEvento.slice(0, 4)))));
    } catch (e) {
      setLote("Não foi possível ler a planilha: " + (e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  const axis = { fontSize: 12, fill: c.text };
  const areas = useMemo(() => [...new Set(acoes.map((a) => a.area).filter(Boolean))].sort(), [acoes]);
  const colunas = ["Data do evento", "Nome", "Tipo", "Áreas de controle", "Ação de melhoria", "Base", "Responsável pela execução", "Prazo (conclusão)", "Situação atual"];

  return (
    <>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <Chips options={anos} selected={[ano]} onToggle={(a) => setAno(a)} />
        <select className="select" style={{ width: "auto", minWidth: 150 }} value={tipoF} onChange={(e) => setTipoF(e.target.value as "" | TipoPlano)} aria-label="Filtrar por tipo de plano">
          <option value="">Tipo: todos</option>
          {TIPOS_PLANO.map((t) => <option key={t} value={t}>{ROTULO_TIPO[t]}</option>)}
        </select>
        <select className="select" style={{ width: "auto", minWidth: 150 }} value={base} onChange={(e) => setBase(e.target.value)} aria-label="Filtrar por base">
          <option value="">Base: todas</option>
          {BASES.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <div className="grow" />
        <button className="btn" onClick={exportar} disabled={!linhas.length && !semFiltrados.length}><Download size={15} /> Exportar Excel</button>
        {admin && (
          <>
            <input ref={arquivo} type="file" accept=".xlsx,.xlsm,.xls" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = ""; }} />
            <button className="btn" disabled={ocupado} onClick={() => arquivo.current?.click()}><FileUp size={15} /> Importar planilha</button>
          </>
        )}
      </div>
      {lote && <div className="foto-prog" role="status" style={{ marginBottom: 12 }}>{lote}</div>}

      <div className="ndgs-kpis">
        {([
          { id: "todas", rotulo: "Ações no plano", v: total, cor: "var(--line)", sub: base ? `base ${base}` : "todas as bases" },
          { id: "CONCLUIDO", rotulo: "Concluídas", v: concluidas, cor: COR_SIT.CONCLUIDO, sub: `${pctConcl}% do total` },
          { id: "EM ANDAMENTO", rotulo: "Em andamento", v: cont("EM ANDAMENTO"), cor: COR_SIT["EM ANDAMENTO"], sub: "dentro do prazo" },
          { id: "PENDENTE", rotulo: "Pendentes", v: cont("PENDENTE"), cor: COR_SIT.PENDENTE, sub: "ainda não iniciadas" },
          { id: "ATRASADO", rotulo: "Atrasadas", v: cont("ATRASADO"), cor: COR_SIT.ATRASADO, sub: "prazo vencido" },
          { id: "SEM", rotulo: "Sinistros sem plano", v: semBase.length, cor: semBase.length ? COR_SIT.ATRASADO : COR_SIT.CONCLUIDO, sub: semBase.length ? "ver tabela abaixo" : "todos com plano" },
        ] as { id: Filtro | "SEM"; rotulo: string; v: number; cor: string; sub: string }[]).map((k) => (
          <button
            key={k.rotulo}
            type="button"
            className={`ndgs-kpi clicavel ${k.id === filtro && k.id !== "todas" ? "ativo" : ""}`}
            style={{ ["--c" as string]: k.cor }}
            aria-pressed={k.id === filtro && k.id !== "todas"}
            onClick={() => (k.id === "SEM" ? document.getElementById("plano-sem")?.scrollIntoView({ behavior: "smooth", block: "start" }) : k.id === "todas" ? setFiltro("todas") : alterarFiltro(k.id))}
          >
            <small>{k.rotulo}</small>
            <b>{k.v}</b>
            <small>{k.sub}</small>
          </button>
        ))}
      </div>

      <div className="grid">
        <Card title="Situação das ações" className="s5">
          {donut.length ? (
            <>
              <div className="donut" style={{ height: 240 }}>
                <ResponsiveContainer>
                  <PieChart margin={{ top: 14, right: 14, bottom: 14, left: 14 }}>
                    <Pie data={donut} dataKey="value" nameKey="name" innerRadius={62} outerRadius={100} paddingAngle={2} cornerRadius={5} stroke="none" isAnimationActive={false} label={(p: any) => rotuloFatia(p)} labelLine={false} onClick={(d: any) => alterarFiltro((d?.sit ?? d?.payload?.sit) as Filtro)} style={{ cursor: "pointer" }}>
                      {donut.map((d) => <Cell key={d.sit} fill={COR_SIT[d.sit]} fillOpacity={filtro !== "todas" && filtro !== d.sit ? 0.3 : 1} />)}
                    </Pie>
                    <Tooltip
                      wrapperStyle={{ zIndex: 20, pointerEvents: "none" }}
                      offset={36}
                      content={(p: any) => {
                        const d = p.payload?.[0]?.payload;
                        return d ? <Dica active={p.active} linhas={[{ cor: COR_SIT[d.sit as SituacaoAcao], nome: d.name, valor: `${d.value} (${Math.round((d.value / (total || 1)) * 100)}%)` }]} /> : null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="center">
                  <b>{pctConcl}%</b>
                  <small>concluído</small>
                </div>
              </div>
              <div className="legend plano-legenda">
                {SITUACOES.map((s) => (
                  <button key={s} type="button" className={`leg-item ${filtro === s ? "on" : ""}`} style={{ opacity: filtro !== "todas" && filtro !== s ? 0.45 : 1 }} onClick={() => alterarFiltro(s)}>
                    <i style={{ background: COR_SIT[s] }} />
                    {ROTULO_SIT[s]} · {cont(s)}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <Empty />
          )}
        </Card>

        <Card title="Ações por base" className="s7">
          {porBase.length ? (
            <>
            <div style={{ height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={porBase} margin={{ top: 10, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="3 5" />
                  <XAxis dataKey="base" tick={axis} axisLine={false} tickLine={false} />
                  <YAxis hide allowDecimals={false} domain={[0, (max: number) => Math.ceil(max * 1.18)]} />
                  <Tooltip
                    cursor={{ fill: c.cursor, radius: 8 }}
                    wrapperStyle={{ zIndex: 20, pointerEvents: "none" }}
                    content={(p: any) => {
                      const row = p.payload?.[0]?.payload as Record<string, number | string> | undefined;
                      if (!row) return null;
                      const linhas = SITUACOES.filter((s) => (row[s] as number) > 0).map((s) => ({ cor: COR_SIT[s], nome: ROTULO_SIT[s], valor: String(row[s]) }));
                      const conc = Math.round(((row.CONCLUIDO as number) / ((row.total as number) || 1)) * 100);
                      return <Dica active={p.active} titulo={`Base ${row.base}`} linhas={linhas} rodape={`Total ${row.total} · ${conc}% concluído`} />;
                    }}
                  />
                  {SITUACOES.map((s) => (
                    <Bar key={s} dataKey={s} name={ROTULO_SIT[s]} stackId="p" fill={COR_SIT[s]} maxBarSize={46} isAnimationActive={false} style={{ cursor: "pointer" }} onClick={(d: any) => setBase((b) => (b === d?.base ? "" : d?.base))}>
                      {porBase.map((d) => <Cell key={String(d.base)} fill={COR_SIT[s]} fillOpacity={base && base !== d.base ? 0.3 : 1} />)}
                      <LabelList dataKey={s} position="center" formatter={(v: unknown) => (Number(v) ? String(v) : "")} fill="#1d1a1f" fontSize={11} fontWeight={700} />
                    </Bar>
                  ))}
                  <Bar dataKey="topo" stackId="p" fill="transparent" isAnimationActive={false} legendType="none" tooltipType="none">
                    <LabelList dataKey="total" position="top" offset={6} fill={c.text} fontSize={13} fontWeight={700} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="legend plano-legenda">
              {SITUACOES.map((s) => (
                <button key={s} type="button" className={`leg-item ${filtro === s ? "on" : ""}`} style={{ opacity: filtro !== "todas" && filtro !== s ? 0.45 : 1 }} onClick={() => alterarFiltro(s)}>
                  <i style={{ background: COR_SIT[s] }} />
                  {ROTULO_SIT[s]}
                </button>
              ))}
            </div>
            </>
          ) : (
            <Empty />
          )}
        </Card>

        <Card title="Plano de ação dos sinistros" extra={`${linhas.length} linha(s)`} className="s12">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
            <div className="seg" role="group" aria-label="Filtrar por situação" style={{ flexWrap: "wrap" }}>
              {FILTROS.map((f) => (
                <button key={f.id} className={filtro === f.id ? "on" : ""} onClick={() => setFiltro(f.id)}>{f.rotulo}</button>
              ))}
            </div>
            <input className="input" style={{ flex: "1 1 260px", minWidth: 220 }} placeholder="Buscar por nome ou responsável…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar ações por nome" />
            {busca && <button className="btn" onClick={() => setBusca("")}><X size={14} /> Limpar busca</button>}
          </div>
          {linhas.length ? (
            <div className="table-wrap table-scroll" style={{ maxHeight: "70vh" }}>
              <table className="plano-tabela" style={{ minWidth: 1290 }}>
                <thead>
                  <tr>
                    {colunas.map((t) => <th key={t}>{t}</th>)}
                    {admin && <th>Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((x, i) => {
                    const a = x.a;
                    const m = mudou(a);
                    const sit = situacaoEfetiva({ ...a, situacao: valor(a, "situacao"), prazo: valor(a, "prazo") }, hoje);
                    return (
                      <tr key={a.id}>
                        {admin ? (
                          <>
                            <td><input className="input" type="date" value={valor(a, "dataEvento")} onChange={(e) => editar(a, { dataEvento: e.target.value })} style={{ width: 128 }} aria-label="Data do evento" />{marca(x, i)}</td>
                            <td>
                              <select className="select" value={tipoDe({ tipo: valor(a, "tipo") })} onChange={(e) => editar(a, { tipo: e.target.value as TipoPlano })} style={{ width: 108 }} aria-label="Tipo do plano">
                                {TIPOS_PLANO.map((t) => <option key={t} value={t}>{ROTULO_TIPO[t]}</option>)}
                              </select>
                            </td>
                            <td><input className="input" value={valor(a, "nome")} onChange={(e) => editar(a, { nome: e.target.value })} style={{ width: 150 }} aria-label="Nome" /></td>
                            <td><input className="input" list="plano-areas" value={valor(a, "area")} onChange={(e) => editar(a, { area: e.target.value })} style={{ width: 140 }} aria-label="Áreas de controle" /></td>
                            <td><textarea className="input" rows={3} value={valor(a, "acao")} onChange={(e) => editar(a, { acao: e.target.value })} style={{ width: 250, resize: "vertical" }} aria-label="Ação de melhoria" /></td>
                            <td>
                              <select className="select" value={valor(a, "base")} onChange={(e) => editar(a, { base: e.target.value })} style={{ width: 72 }} aria-label="Base">
                                <option value="">—</option>
                                {[...new Set([...BASES, valor(a, "base")])].filter(Boolean).map((b) => <option key={b} value={b}>{b}</option>)}
                              </select>
                            </td>
                            <td><input className="input" value={valor(a, "responsavel")} onChange={(e) => editar(a, { responsavel: e.target.value })} style={{ width: 150 }} aria-label="Responsável pela execução" /></td>
                            <td><input className="input" type="date" value={valor(a, "prazo") ?? ""} onChange={(e) => editar(a, { prazo: e.target.value || null })} style={{ width: 128 }} aria-label="Prazo de conclusão" /></td>
                            <td>
                              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                                <select className="select" value={valor(a, "situacao") === "ATRASADO" ? "EM ANDAMENTO" : valor(a, "situacao")} onChange={(e) => editar(a, { situacao: e.target.value as SituacaoAcao })} style={{ width: 130 }} aria-label="Situação atual">
                                  {(["CONCLUIDO", "EM ANDAMENTO", "PENDENTE"] as SituacaoAcao[]).map((s) => <option key={s} value={s}>{ROTULO_SIT[s]}</option>)}
                                </select>
                                {sit === "ATRASADO" && <Selo sit="ATRASADO" />}
                              </div>
                            </td>
                            <td>
                              <div className="plano-acoes">
                                {a.situacao !== "CONCLUIDO" ? (
                                  <button className="btn primary" onClick={() => salvar([montar(a, { situacao: "CONCLUIDO" })], "Ação concluída")} title="Marcar como concluída"><Check size={14} /> Concluir</button>
                                ) : (
                                  <button className="btn" onClick={() => salvar([montar(a, { situacao: "EM ANDAMENTO" })], "Ação reaberta")} title="Reabrir a ação"><RotateCcw size={14} /> Reabrir</button>
                                )}
                                <button className={`btn ${m ? "primary" : ""}`} disabled={!m || !completa(montar(a))} title={m && !completa(montar(a)) ? `Faltam: ${faltando(montar(a)).join(", ")}` : undefined} onClick={() => salvar([montar(a)], "Ação salva")}>Salvar</button>
                                <button className="btn" onClick={() => abrirNova({ registroId: a.registroId ?? x.s?.id ?? null, dataEvento: a.dataEvento, nome: a.nome, base: a.base, tipo: tipoDe(a) })} title="Cadastrar outra ação para este sinistro"><Plus size={14} /> Nova ação</button>
                                <button className="btn" onClick={() => excluir(a)} title="Excluir a ação"><Trash2 size={14} /> Excluir</button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td>{fmtData(a.dataEvento)}{marca(x, i)}</td>
                            <td><b>{a.nome}</b></td>
                            <td>{ROTULO_TIPO[tipoDe(a)]}</td>
                            <td>{a.area}</td>
                            <td style={{ minWidth: 300, whiteSpace: "normal" }}>{a.acao}</td>
                            <td>{a.base}</td>
                            <td>{a.responsavel}</td>
                            <td>{a.prazo ? fmtData(a.prazo) : "—"}</td>
                            <td><Selo sit={sit} /></td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <datalist id="plano-areas">{areas.map((a) => <option key={a} value={a} />)}</datalist>
            </div>
          ) : (
            <Empty />
          )}
          {admin && (
            <div className="calc-fill">
              <button className="btn primary" disabled={!pendentes.length} onClick={() => salvar(pendentes.map((a) => montar(a)), `${pendentes.length} ação(ões) salva(s)`)}>Salvar todas as alterações{pendentes.length ? ` (${pendentes.length})` : ""}</button>
              <small style={{ color: "var(--muted)" }}>Ações não concluídas com prazo vencido aparecem como atrasadas automaticamente. Concluir grava a data de hoje como conclusão.</small>
            </div>
          )}
        </Card>

        <div id="plano-sem" className="s12" style={{ scrollMarginTop: 16 }}>
        <Card title="Sinistros sem plano de ação" extra={`${semFiltrados.length} de ${semPlano.length} sem plano completo`}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
            <input className="input" style={{ flex: "1 1 280px", minWidth: 220 }} placeholder="Buscar por colaborador, prefixo, característica…" value={sBusca} onChange={(e) => setSBusca(e.target.value)} aria-label="Buscar sinistros sem plano" />
            <select className="select" style={{ width: "auto", minWidth: 150 }} value={sMes} onChange={(e) => setSMes(e.target.value)} aria-label="Filtrar por mês">
              <option value="">Mês: todos</option>
              {mesesSem.map((m) => <option key={m} value={m}>{MESES[Number(m) - 1]}</option>)}
            </select>
            <select className="select" style={{ width: "auto", minWidth: 150 }} value={sBase} onChange={(e) => setSBase(e.target.value)} aria-label="Filtrar por base">
              <option value="">Base: todas</option>
              {BASES.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            {(sBusca || sMes || sBase) && <button className="btn" onClick={() => { setSBusca(""); setSMes(""); setSBase(""); }}>Limpar filtros</button>}
          </div>
          {admin && <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 10px" }}>Clique em um sinistro para preencher o plano de ação. A ação só sobe para a tabela de cima quando todos os campos estiverem preenchidos. Um sinistro pode ter mais de uma ação.</p>}
          {semFiltrados.length ? (
            <div className="table-wrap table-scroll" style={{ maxHeight: "60vh" }}>
              <table className="plano-tabela" style={{ minWidth: 900 }}>
                <thead>
                  <tr>
                    <th>Data do evento</th><th>Colaborador / equipe</th><th>Gerência</th><th>Base</th><th>Característica</th><th>Situação do plano</th>
                    {admin && <th>Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {semFiltrados.map((l) => (
                    <tr key={(l.s?.id ?? "") + (l.rasc?.id ?? "")} onClick={() => abrirLinha(l)} style={{ cursor: admin ? "pointer" : "default" }} title={admin ? "Clique para preencher o plano de ação" : undefined}>
                      <td>{fmtData(dataDe(l))}</td>
                      <td><b>{nomeDe(l)}</b>{l.s?.prefixo && <><br /><small style={{ color: "var(--muted)" }}>{l.s.prefixo}</small></>}</td>
                      <td>{l.s?.processo ?? ""}</td>
                      <td>{baseDe(l)}</td>
                      <td style={{ whiteSpace: "normal" }}>{l.s ? l.s.caracteristica || l.s.tipo || "—" : l.rasc?.acao || "—"}</td>
                      <td>
                        {l.rasc ? (
                          <span className="badge" style={{ background: COR_SIT["EM ANDAMENTO"] + "33", color: COR_SIT["EM ANDAMENTO"], fontWeight: 700, whiteSpace: "normal" }} title={faltando(l.rasc).join(", ")}>Incompleto · faltam {faltando(l.rasc).length}</span>
                        ) : (
                          <span className="badge" style={{ background: COR_SIT.ATRASADO + "33", color: COR_SIT.ATRASADO, fontWeight: 700 }}>Sem plano</span>
                        )}
                      </td>
                      {admin && <td><button className="btn" style={{ padding: "5px 12px" }} onClick={(e) => { e.stopPropagation(); abrirLinha(l); }}><Plus size={14} /> {l.rasc ? "Completar plano" : "Preencher plano"}</button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty />
          )}
        </Card>
        </div>
      </div>
      {form && <FormAcao key={form.acao.id} inicial={form.acao} novo={form.novo} areas={areas} onSalvar={incluir} onExcluir={form.novo ? undefined : () => descartar(form.acao)} onFechar={() => setForm(null)} />}
      {toast && <Toast msg={toast} onDone={() => setToast("")} />}
    </>
  );
}
