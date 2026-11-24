import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info as IconeInfo } from "lucide-react";

export interface Ajuda {
  como: string; // como ler a informação
  porque: string; // por que ela importa para a decisão
}

/** Ícone "i" que abre uma explicação curta: como ler e qual a importância. Abre por clique, toque, foco ou mouse. */
export default function Info({ titulo, ajuda, tamanho = 15 }: { titulo: string; ajuda: Ajuda; tamanho?: number }) {
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number; acima: boolean }>({ x: 0, y: 0, acima: false });
  const botao = useRef<HTMLButtonElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    if (!aberto || !botao.current) return;
    const r = botao.current.getBoundingClientRect();
    const largura = Math.min(340, window.innerWidth - 24);
    const x = Math.max(12, Math.min(r.left + r.width / 2 - largura / 2, window.innerWidth - largura - 12));
    const altura = caixa.current?.offsetHeight ?? 200;
    const acima = r.bottom + altura + 16 > window.innerHeight && r.top > altura + 16;
    setPos({ x, y: acima ? r.top - 10 : r.bottom + 10, acima });
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: Event) => {
      const t = e.target as Node;
      if (!botao.current?.contains(t) && !caixa.current?.contains(t)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    const fecha = () => setAberto(false);
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    window.addEventListener("scroll", fecha, true);
    window.addEventListener("resize", fecha);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("scroll", fecha, true);
      window.removeEventListener("resize", fecha);
    };
  }, [aberto]);

  return (
    <>
      <button
        ref={botao}
        type="button"
        className={`info-btn ${aberto ? "on" : ""}`}
        aria-label={`Como ler: ${titulo}`}
        aria-expanded={aberto}
        aria-controls={aberto ? id : undefined}
        onClick={(e) => { e.stopPropagation(); setAberto((v) => !v); }}
        onMouseEnter={() => matchMedia("(hover: hover)").matches && setAberto(true)}
        onMouseLeave={(e) => { if (matchMedia("(hover: hover)").matches && !(e.relatedTarget instanceof Node && caixa.current?.contains(e.relatedTarget))) setAberto(false); }}
      >
        <IconeInfo size={tamanho} />
      </button>
      {aberto &&
        createPortal(
          <div
            ref={caixa}
            id={id}
            role="tooltip"
            className="info-pop"
            style={{ left: pos.x, top: pos.y, transform: pos.acima ? "translateY(-100%)" : undefined }}
            onMouseLeave={() => matchMedia("(hover: hover)").matches && setAberto(false)}
          >
            <b>{titulo}</b>
            <div><small>Como ler</small><p>{ajuda.como}</p></div>
            <div><small>Por que importa</small><p>{ajuda.porque}</p></div>
          </div>,
          document.body,
        )}
    </>
  );
}
