import { useMemo, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { Registro } from "../types";
import { BASES, CARACTERISTICAS, ENVOLVIDOS, GERENCIAS, LESOES, TIPOS, TURNOS } from "../types";
import { turnoDaHora } from "../lib/parse";
import { useTravaRolagem } from "./ui";
import { useData } from "../lib/store";
import { equipeDe, normPrefixo } from "../lib/equipes";

const hoje = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);

const vazio = (categoria: Registro["categoria"]): Omit<Registro, "id"> => ({
  categoria,
  data: hoje(),
  hora: "",
  turno: "",
  colaborador: "",
  prefixo: "",
  processo: "",
  base: "",
  cidade: "",
  supervisor: "",
  tipo: "",
  caracteristica: "",
  definicao: "",
  descricao: "",
  envolvidos: "PRÓPRIOS",
  gravidade: "LEVE",
  lesao: "SEM AFASTAMENTO",
  cat: "",
  trajeto: "NÃO",
  comunicadoEqtl: "SIM",
});

const OBRIGATORIOS: [keyof Registro, string][] = [
  ["data", "Informe a data"],
  ["colaborador", "Informe o colaborador ou a equipe"],
  ["processo", "Escolha a gerência"],
  ["base", "Escolha a base"],
  ["tipo", "Escolha o tipo"],
  ["descricao", "Descreva o ocorrido"],
];

export default function RecordForm({ inicial, categoria, onSave, onClose }: { inicial?: Registro; categoria: Registro["categoria"]; onSave: (r: Omit<Registro, "id"> | Registro) => void; onClose: () => void }) {
  useTravaRolagem();
  const [f, setF] = useState<Omit<Registro, "id"> & { id?: string }>(inicial ?? vazio(categoria));
  const [erros, setErros] = useState<Record<string, string>>({});
  const acidente = f.categoria === "acidente";
  const set = <K extends keyof Registro>(k: K, v: Registro[K]) => setF((s) => ({ ...s, [k]: v }));
  const { data } = useData();
  // sugestões vindas dos próprios registros: nomes e prefixos já cadastrados, do mais recente para o mais antigo
  const sugestoes = useMemo(() => {
    const recentes = [...data.registros].sort((a, b) => b.data.localeCompare(a.data));
    const ultimoDe = (campo: "colaborador" | "prefixo") => {
      const m = new Map<string, Registro>();
      for (const r of recentes) if (r[campo] && !m.has(r[campo].toUpperCase())) m.set(r[campo].toUpperCase(), r);
      return m;
    };
    return { colab: ultimoDe("colaborador"), prefixo: ultimoDe("prefixo") };
  }, [data.registros]);
  const nomesColab = useMemo(() => [...sugestoes.colab.keys()].sort((a, b) => a.localeCompare(b)), [sugestoes]);
  const nomesPrefixo = useMemo(() => [...new Set([...data.equipes.map((e) => normPrefixo(e.prefixo)), ...sugestoes.prefixo.keys()])].sort((a, b) => a.localeCompare(b)), [sugestoes, data.equipes]);
  // ao escolher uma equipe do cadastro, base e gerência vêm dela
  const aplicarEquipe = (p: string) => {
    const eq = equipeDe(p);
    if (eq) setF((s) => ({ ...s, base: eq.base || s.base, processo: eq.gerencia || s.processo }));
  };
  // ao escolher um nome/prefixo conhecido, completa os campos ainda vazios com o último registro dele
  const completar = (ref: Registro | undefined, campos: ("prefixo" | "processo" | "base" | "cidade" | "supervisor")[]) =>
    ref && setF((s) => ({ ...s, ...Object.fromEntries(campos.filter((c) => !s[c] && ref[c]).map((c) => [c, ref[c]])) }));
  const carac = [...new Set([...CARACTERISTICAS, ...(f.caracteristica ? [f.caracteristica] : [])])];

  function submit(e: FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    for (const [k, msg] of OBRIGATORIOS) if (!String(f[k] ?? "").trim()) er[k] = msg;
    if (acidente && !f.caracteristica) er.caracteristica = "Escolha a característica";
    setErros(er);
    if (Object.keys(er).length) return;
    onSave({
      ...f,
      colaborador: f.colaborador.trim().toUpperCase(),
      prefixo: f.prefixo.trim().toUpperCase(),
      turno: f.turno || turnoDaHora(f.hora),
      diasPerdidos: f.diasPerdidos ?? undefined,
      diasDebitados: f.diasDebitados ?? undefined,
    } as Registro);
  }

  const err = (k: string) => erros[k] && <span className="err">{erros[k]}</span>;
  const opts = (l: string[]) => l.map((o) => <option key={o}>{o}</option>);

  return (
    <div className="overlay center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit} role="dialog" aria-modal="true" aria-label="Registro">
        <div className="modal-head">
          <h2>{inicial ? "Editar registro" : acidente ? "Novo acidente" : "Novo incidente interno"}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        </div>

        <div className="form-sec">Evento</div>
        <div className="form-grid">
          <div className="field"><label>Data *</label><input className="input" type="date" value={f.data} onChange={(e) => set("data", e.target.value)} />{err("data")}</div>
          {acidente && (
            <div className="field">
              <label>Hora</label>
              <input className="input" type="time" value={f.hora ?? ""} onChange={(e) => setF((s) => ({ ...s, hora: e.target.value, turno: turnoDaHora(e.target.value) }))} />
            </div>
          )}
          {acidente && (
            <div className="field">
              <label>Turno</label>
              <select className="select" value={f.turno} onChange={(e) => set("turno", e.target.value)}>
                <option value="">Não informado</option>{opts(TURNOS)}
              </select>
            </div>
          )}
          <div className="field">
            <label>Tipo *</label>
            {acidente ? (
              <select className="select" value={f.tipo} onChange={(e) => set("tipo", e.target.value)}><option value="">Selecione</option>{opts(TIPOS)}</select>
            ) : (
              <input className="input" value={f.tipo} onChange={(e) => set("tipo", e.target.value.toUpperCase())} placeholder="Ex.: DANO A VEÍCULO" />
            )}
            {err("tipo")}
          </div>
          {acidente && (
            <div className="field full">
              <label>Característica *</label>
              <select className="select" value={f.caracteristica} onChange={(e) => set("caracteristica", e.target.value)}><option value="">Selecione</option>{opts(carac)}</select>
              {err("caracteristica")}
            </div>
          )}
          {acidente && (
            <div className="field full"><label>Definição</label><input className="input" value={f.definicao} onChange={(e) => set("definicao", e.target.value)} placeholder="Ex.: COLISÃO NA TRASEIRA DE TERCEIROS" /></div>
          )}
          <div className="field full"><label>Descrição *</label><textarea className="textarea" value={f.descricao} onChange={(e) => set("descricao", e.target.value)} />{err("descricao")}</div>
        </div>

        <div className="form-sec">Pessoas e local</div>
        <div className="form-grid">
          <datalist id="lista-colaboradores">{nomesColab.map((n) => <option key={n} value={n} />)}</datalist>
          <datalist id="lista-prefixos">{nomesPrefixo.map((n) => { const e = equipeDe(n); return <option key={n} value={n} label={e ? [e.base, e.gerencia, e.coordenador].filter(Boolean).join(" · ") : undefined} />; })}</datalist>
          <div className="field"><label>Colaborador / equipe *</label><input className="input" list="lista-colaboradores" autoComplete="off" value={f.colaborador} onChange={(e) => { set("colaborador", e.target.value); completar(sugestoes.colab.get(e.target.value.trim().toUpperCase()), ["prefixo", "processo", "base", "cidade", "supervisor"]); }} />{err("colaborador")}</div>
          <div className="field"><label>Prefixo</label><input className="input" list="lista-prefixos" autoComplete="off" value={f.prefixo} onChange={(e) => { set("prefixo", e.target.value); aplicarEquipe(e.target.value); completar(sugestoes.prefixo.get(normPrefixo(e.target.value)), ["processo", "base", "cidade", "supervisor"]); }} placeholder="MA-PDS-V001M" />{equipeDe(f.prefixo) && <small className="hint">Equipe cadastrada: {[equipeDe(f.prefixo)!.base, equipeDe(f.prefixo)!.gerencia, "coord. " + equipeDe(f.prefixo)!.coordenador, "gerente " + equipeDe(f.prefixo)!.gerente].filter(Boolean).join(" · ")}</small>}</div>
          <div className="field"><label>Gerência *</label><select className="select" value={f.processo} onChange={(e) => set("processo", e.target.value)}><option value="">Selecione</option>{opts(GERENCIAS)}</select>{err("processo")}</div>
          <div className="field"><label>Base *</label><select className="select" value={f.base} onChange={(e) => set("base", e.target.value)}><option value="">Selecione</option>{opts(BASES)}</select>{err("base")}</div>
          <div className="field"><label>Cidade</label><input className="input" value={f.cidade} onChange={(e) => set("cidade", e.target.value.toUpperCase())} /></div>
          <div className="field"><label>Supervisor</label><input className="input" value={f.supervisor} onChange={(e) => set("supervisor", e.target.value.toUpperCase())} /></div>
          <div className="field"><label>Envolvidos</label><select className="select" value={f.envolvidos} onChange={(e) => set("envolvidos", e.target.value as Registro["envolvidos"])}>{opts(ENVOLVIDOS)}</select></div>
        </div>

        <div className="form-sec">Gravidade</div>
        <div className="form-grid">
          <div className="field"><label>Lesão *</label><select className="select" value={f.lesao} onChange={(e) => set("lesao", e.target.value)}>{opts(acidente ? [...LESOES] : ["SEM AFASTAMENTO"])}</select></div>
          <div className="field"><label>Gravidade</label><select className="select" value={f.gravidade} onChange={(e) => set("gravidade", e.target.value)}>{opts(["LEVE", "MODERADA", "GRAVE", "FATAL"])}</select></div>
          {acidente && (
            <>
              {(f.lesao === "COM AFASTAMENTO" || f.lesao === "FATAL") && (
                <>
                  <div className="field">
                    <label>Dias perdidos</label>
                    <input className="input" type="number" min={0} inputMode="numeric" value={f.diasPerdidos ?? ""} onChange={(e) => set("diasPerdidos", e.target.value === "" ? undefined : Number(e.target.value))} />
                    <span className="hint">Dias corridos de afastamento, sem contar o dia do acidente nem o da volta.</span>
                  </div>
                  <div className="field">
                    <label>Dias debitados</label>
                    <input className="input" type="number" min={0} inputMode="numeric" value={f.diasDebitados ?? ""} placeholder={f.lesao === "FATAL" ? "6000 (padrão para morte)" : "0"} onChange={(e) => set("diasDebitados", e.target.value === "" ? undefined : Number(e.target.value))} />
                    <span className="hint">Só para morte, incapacidade permanente ou perda de membro (tabela da NBR 14280).</span>
                  </div>
                </>
              )}
              <div className="field"><label>Nº da CAT</label><input className="input" value={f.cat} onChange={(e) => set("cat", e.target.value)} placeholder="NA" /></div>
              <div className="field"><label>Trajeto</label><select className="select" value={f.trajeto} onChange={(e) => set("trajeto", e.target.value)}>{opts(["NÃO", "SIM"])}</select></div>
              <div className="field"><label>Comunicado EQTL</label><select className="select" value={f.comunicadoEqtl} onChange={(e) => set("comunicadoEqtl", e.target.value)}>{opts(["SIM", "NÃO"])}</select></div>
            </>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary">Salvar registro</button>
        </div>
      </form>
    </div>
  );
}
