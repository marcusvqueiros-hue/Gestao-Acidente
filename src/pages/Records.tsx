import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Pencil, Plus, Search, Trash2, Upload, Users, X } from "lucide-react";
import { useData } from "../lib/store";
import { useAuth } from "../lib/auth";
import { aplicar, useFiltros } from "../lib/filters";
import { fmtData } from "../lib/stats";
import { parseWorkbook } from "../lib/parse";
import { gerenteDe, parseEquipes } from "../lib/equipes";
import { colaboradorDe, parseColaboradores } from "../lib/colaboradores";
import { coordenadorDe, NOMES_DAS_REGRAS } from "../lib/coordenacao";
import type { Registro } from "../types";
import { Badge, Card, Empty, Toast, useTravaRolagem } from "../components/ui";
import RecordForm from "../components/RecordForm";

const PAGE = 20;

function Detail({ r, registra, onClose, onEdit, onDelete }: { r: Registro; registra: boolean; onClose: () => void; onEdit: () => void; onDelete: () => void }) {
  useTravaRolagem();
  const linhas: [string, string | undefined][] = [
    ["Data", `${fmtData(r.data)}${r.hora ? " às " + r.hora : ""}`],
    ["Turno", r.turno],
    ["Colaborador", r.colaborador],
    ["Chapa", colaboradorDe(r.colaborador)?.chapa],
    ["Função", colaboradorDe(r.colaborador)?.funcao],
    ["Prefixo", r.prefixo],
    ["Gerência", r.processo],
    ["Base", r.base],
    ["Cidade", r.cidade],
    ["Supervisor", r.supervisor],
    ["Coordenador", coordenadorDe(r)],
    ["Gerente", gerenteDe(r)],
    ["Tipo", r.tipo],
    ["Característica", r.caracteristica],
    ["Definição", r.definicao],
    ["Envolvidos", r.envolvidos],
    ["Gravidade", r.gravidade],
    ["Dias perdidos", r.diasPerdidos != null ? String(r.diasPerdidos) : undefined],
    ["Dias debitados", r.diasDebitados != null ? String(r.diasDebitados) : r.lesao === "FATAL" ? "6000 (padrão)" : undefined],
    ["Nº da CAT", r.cat],
    ["Trajeto", r.trajeto],
    ["Comunicado EQTL", r.comunicadoEqtl],
  ];
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Detalhes do registro">
        <div className="modal-head">
          <div><Badge lesao={r.lesao} /></div>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        </div>
        <dl className="dl">
          {linhas.filter(([, v]) => v).map(([k, v]) => (<><dt key={k + "t"}>{k}</dt><dd key={k}>{v}</dd></>))}
        </dl>
        <div>
          <div className="form-sec" style={{ marginBottom: 8 }}>Descrição</div>
          <div className="desc">{r.descricao || "—"}</div>
        </div>
        {!!r.acoes?.length && (
          <div>
            <div className="form-sec" style={{ marginBottom: 8 }}>Plano de ação</div>
            <div className="steps">
              {r.acoes.map((a) => (
                <div key={a.etapa}>
                  <b>{a.etapa}</b>
                  <span>Prazo {a.prazo ? fmtData(a.prazo) : "—"} · {a.realizacao ? "realizado " + fmtData(a.realizacao) : "pendente"}</span>
                  <span className="badge" style={{ background: a.status === "ATRASADO" ? "#fbe3e5" : "#e3f3e8", color: a.status === "ATRASADO" ? "#b3202f" : "#1f7a3d" }}>{a.status ?? "—"}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {registra && (
          <div className="modal-actions" style={{ marginTop: "auto" }}>
            <button className="btn danger" onClick={onDelete}><Trash2 size={15} /> Excluir</button>
            <button className="btn primary" onClick={onEdit}><Pencil size={15} /> Editar</button>
          </div>
        )}
      </aside>
    </div>
  );
}

export default function Records() {
  const { data, addRegistro, updateRegistro, removeRegistro, replaceAll, setEquipes, setColaboradores, carregando, nuvem } = useData();
  const { filtros } = useFiltros();
  const { admin, registra } = useAuth();
  const [categoria, setCategoria] = useState<Registro["categoria"]>("acidente");
  const [q, setQ] = useState("");
  const [pagina, setPagina] = useState(0);
  const [sel, setSel] = useState<Registro | null>(null);
  const [form, setForm] = useState<{ inicial?: Registro } | null>(null);
  const [toast, setToast] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const fileEq = useRef<HTMLInputElement>(null);
  const fileCol = useRef<HTMLInputElement>(null);

  const lista = useMemo(() => {
    const t = q.trim().toLowerCase();
    return aplicar(data.registros.filter((r) => r.categoria === categoria), filtros)
      .filter((r) => !t || [r.colaborador, r.prefixo, r.cidade, r.tipo, r.caracteristica, r.descricao, r.supervisor].join(" ").toLowerCase().includes(t))
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [data, categoria, filtros, q]);

  const paginas = Math.max(1, Math.ceil(lista.length / PAGE));
  const pg = Math.min(pagina, paginas - 1);
  const visiveis = lista.slice(pg * PAGE, pg * PAGE + PAGE);

  async function salvar(r: Omit<Registro, "id"> | Registro) {
    const erro = "id" in r && r.id ? await updateRegistro(r as Registro) : await addRegistro(r);
    if (erro) return setToast(erro);
    setForm(null);
    setSel(null);
    setToast("Registro salvo");
  }

  async function excluir(r: Registro) {
    if (!confirm(`Excluir o registro de ${fmtData(r.data)} (${r.colaborador})? Essa ação não pode ser desfeita.`)) return;
    const erro = await removeRegistro(r.id);
    if (erro) return setToast(erro);
    setSel(null);
    setToast("Registro excluído");
  }

  async function importar(f: File) {
    try {
      const X = await import("xlsx");
      const ds = parseWorkbook(X, X.read(await f.arrayBuffer(), { type: "array" }));
      if (!ds.registros.length) return setToast("Nenhum registro encontrado na planilha (aba BASE)");
      const ac = ds.registros.filter((r) => r.categoria === "acidente").length;
      if (!confirm(`Substituir a base atual por ${ac} acidentes, ${ds.registros.length - ac} incidentes internos e ${ds.taxas.length} meses de taxas?`)) return;
      setToast("Importando… aguarde");
      const erro = await replaceAll(ds.taxas.length ? ds : { ...ds, taxas: data.taxas });
      setToast(erro ?? "Base importada");
    } catch {
      setToast("Não foi possível ler a planilha");
    }
  }

  async function importarEquipes(f: File) {
    try {
      const X = await import("xlsx");
      const lista = parseEquipes(X, X.read(await f.arrayBuffer(), { type: "array" }), NOMES_DAS_REGRAS);
      if (!lista.length) return setToast("Nenhuma equipe encontrada (colunas: Prefixo, Base, Gerência, Coordenador, Gerente)");
      if (!confirm(`Substituir o cadastro atual (${data.equipes.length} equipes) por ${lista.length} equipes da planilha?`)) return;
      setToast("Importando equipes… aguarde");
      const erro = await setEquipes(lista);
      setToast(erro ?? `${lista.length} equipes importadas`);
    } catch {
      setToast("Não foi possível ler a planilha de equipes");
    }
  }

  async function importarColaboradores(f: File) {
    try {
      const X = await import("xlsx");
      const lista = parseColaboradores(X, X.read(await f.arrayBuffer(), { type: "array" }));
      if (!lista.length) return setToast("Nenhum colaborador encontrado (aba Base: CHAPA, NOME, FUNÇÃO, BASE, PROCESSO, GERENCIA, SITUAÇÃO)");
      if (!confirm(`Substituir o quadro atual (${data.colaboradores.length} colaboradores) por ${lista.length} da planilha?`)) return;
      setToast("Importando colaboradores… aguarde");
      const erro = await setColaboradores(lista);
      setToast(erro ?? `${lista.length} colaboradores importados`);
    } catch {
      setToast("Não foi possível ler a planilha de colaboradores");
    }
  }

  async function exportar() {
    const X = await import("xlsx");
    const linhas = lista.map((r) => ({
      DATA: fmtData(r.data), HORA: r.hora ?? "", TURNO: r.turno, COLABORADOR: r.colaborador, PREFIXO: r.prefixo,
      GERÊNCIA: r.processo, BASE: r.base, CIDADE: r.cidade, SUPERVISOR: r.supervisor, COORDENADOR: coordenadorDe(r), GERENTE: gerenteDe(r), TIPO: r.tipo,
      CARACTERÍSTICA: r.caracteristica, DEFINIÇÃO: r.definicao, DESCRIÇÃO: r.descricao, ENVOLVIDOS: r.envolvidos,
      GRAVIDADE: r.gravidade, LESÃO: r.lesao, "DIAS PERDIDOS": r.diasPerdidos ?? "", "DIAS DEBITADOS": r.diasDebitados ?? "", CAT: r.cat, TRAJETO: r.trajeto,
    }));
    const wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(linhas), categoria === "acidente" ? "Acidentes" : "Incidentes");
    X.writeFile(wb, `registros-${categoria}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <>
      <div className="topbar" style={{ gap: 10 }}>
        <div className="seg" role="group" aria-label="Tipo de registro">
          <button className={categoria === "acidente" ? "on" : ""} onClick={() => { setCategoria("acidente"); setPagina(0); }}>Acidentes</button>
          <button className={categoria === "incidente_interno" ? "on" : ""} onClick={() => { setCategoria("incidente_interno"); setPagina(0); }}>Incidentes internos</button>
        </div>
        <div className="search grow">
          <Search size={16} />
          <input className="input" placeholder="Buscar por colaborador, prefixo, cidade, descrição…" value={q} onChange={(e) => { setQ(e.target.value); setPagina(0); }} />
        </div>
        {admin && <button className="btn" onClick={() => file.current?.click()}><Upload size={15} /> Importar</button>}
        {admin && <button className="btn" onClick={() => fileEq.current?.click()}><Users size={15} /> Importar equipes</button>}
        {admin && <button className="btn" onClick={() => fileCol.current?.click()}><Users size={15} /> Importar colaboradores</button>}
        <button className="btn" onClick={exportar} disabled={!lista.length}><Download size={15} /> Exportar</button>
        {registra && <button className="btn primary" onClick={() => setForm({})}><Plus size={15} /> Novo registro</button>}
        <input ref={fileCol} type="file" accept=".xlsx,.xlsm" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importarColaboradores(f); e.target.value = ""; }} />
        <input ref={fileEq} type="file" accept=".xlsx,.xlsm" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importarEquipes(f); e.target.value = ""; }} />
        <input ref={file} type="file" accept=".xlsx,.xlsm" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = ""; }} />
      </div>

      <Card>
        {lista.length ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Data</th><th>Colaborador / equipe</th><th>Gerência</th><th>Base</th><th>{categoria === "acidente" ? "Característica" : "Tipo"}</th><th>Lesão</th><th>Envolvidos</th></tr>
                </thead>
                <tbody>
                  {visiveis.map((r) => (
                    <tr key={r.id} className="click" onClick={() => setSel(r)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setSel(r)}>
                      <td style={{ whiteSpace: "nowrap" }}>{fmtData(r.data)}</td>
                      <td className="clip" title={r.colaborador}><b>{r.colaborador}</b><br /><small style={{ color: "var(--muted)" }}>{r.prefixo}</small></td>
                      <td>{r.processo}</td>
                      <td>{r.base}</td>
                      <td className="clip" title={r.caracteristica || r.tipo}>{(categoria === "acidente" ? r.caracteristica : r.tipo) || "—"}</td>
                      <td><Badge lesao={r.lesao} /></td>
                      <td>{r.envolvidos === "TERCEIROS" ? "Terceiros" : "Próprios"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pager">
              <span>{lista.length} registro(s) · página {pg + 1} de {paginas}</span>
              <span style={{ display: "flex", gap: 4 }}>
                <button className="icon-btn" disabled={pg === 0} onClick={() => setPagina(pg - 1)} aria-label="Página anterior"><ChevronLeft size={18} /></button>
                <button className="icon-btn" disabled={pg >= paginas - 1} onClick={() => setPagina(pg + 1)} aria-label="Próxima página"><ChevronRight size={18} /></button>
              </span>
            </div>
          </>
        ) : carregando ? (
          <div className="empty">Carregando registros…</div>
        ) : !data.registros.length ? (
          <div className="empty">{admin ? "O banco ainda está vazio. Use Importar para carregar a planilha de monitoramento (aba BASE)." : "Ainda não há registros cadastrados."}</div>
        ) : (
          <Empty />
        )}
      </Card>

      <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 14 }}>
        {registra ? (
          <>
            {nuvem ? "Os registros ficam no banco de dados e aparecem em todos os aparelhos." : "Os registros ficam salvos neste navegador."} Use Exportar para guardar uma cópia{admin ? " e Importar para carregar a planilha completa" : ""}.

          </>
        ) : (
          "Somente administradores e registradores podem cadastrar, editar ou excluir registros. Você tem acesso de consulta."
        )}
      </p>

      {sel && !form && <Detail r={sel} registra={registra} onClose={() => setSel(null)} onEdit={() => setForm({ inicial: sel })} onDelete={() => excluir(sel)} />}
      {registra && form && <RecordForm inicial={form.inicial} categoria={categoria} onSave={salvar} onClose={() => setForm(null)} />}
      {toast && <Toast msg={toast} onDone={() => setToast("")} />}
    </>
  );
}
