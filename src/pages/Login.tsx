import { useEffect, useRef, useState, type FormEvent } from "react";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { Eye, EyeOff, Lock, LogIn, User } from "lucide-react";
import { useAuth } from "../lib/auth";
import { Logo } from "../components/ui";

interface Losango {
  x: number; y: number; s: number; rot: number; vr: number; vx: number; vy: number; a: number; cor: string; fill: boolean;
}

const CORES = ["217,72,95", "179,53,79", "232,160,168", "140,28,61", "255,141,161"];

/** Orbes luminosos e anéis finos flutuando devagar, com leve efeito de profundidade ao mover o mouse. */
function Fundo({ quieto }: { quieto: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    let w = 0, h = 0, raf = 0;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    let itens: Losango[] = [];

    const novo = (inicio: boolean): Losango => ({
      x: Math.random() * w,
      y: inicio ? Math.random() * h : h + 80,
      s: 10 + Math.random() * 64,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.004,
      vx: (Math.random() - 0.5) * 0.12,
      vy: -(0.08 + Math.random() * 0.25),
      a: 0.12 + Math.random() * 0.38,
      cor: CORES[Math.floor(Math.random() * CORES.length)],
      fill: Math.random() > 0.55,
    });

    const medir = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = w < 700 ? 9 : 18;
      itens = Array.from({ length: n }, () => novo(true));
    };

    const desenha = () => {
      ctx.clearRect(0, 0, w, h);
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;
      for (const d of itens) {
        const prof = d.s / 84;
        const px = d.x + mouse.x * 30 * prof;
        const py = d.y + mouse.y * 30 * prof;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(d.rot);
        ctx.beginPath();
        ctx.arc(0, 0, d.s, 0, Math.PI * 2);
        if (d.fill) {
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, d.s);
          g.addColorStop(0, `rgba(${d.cor},${d.a * 0.9})`);
          g.addColorStop(0.55, `rgba(${d.cor},${d.a * 0.18})`);
          g.addColorStop(1, `rgba(${d.cor},0)`);
          ctx.fillStyle = g;
          ctx.fill();
        }
        if (!d.fill) {
          ctx.strokeStyle = `rgba(${d.cor},${d.a})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
        ctx.restore();
        if (!quieto) {
          d.x += d.vx;
          d.y += d.vy;
          d.rot += d.vr;
          if (d.y < -120 || d.x < -140 || d.x > w + 140) Object.assign(d, novo(false), { x: Math.random() * w });
        }
      }
      if (!quieto) raf = requestAnimationFrame(desenha);
    };

    const mover = (e: PointerEvent) => {
      mouse.tx = e.clientX / window.innerWidth - 0.5;
      mouse.ty = e.clientY / window.innerHeight - 0.5;
    };
    const visib = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !quieto) raf = requestAnimationFrame(desenha);
    };

    medir();
    desenha();
    window.addEventListener("resize", medir);
    window.addEventListener("pointermove", mover, { passive: true });
    document.addEventListener("visibilitychange", visib);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", medir);
      window.removeEventListener("pointermove", mover);
      document.removeEventListener("visibilitychange", visib);
    };
  }, [quieto]);

  return <canvas ref={ref} className="lg-canvas" aria-hidden />;
}

/** Linha de batimento: ideia de "monitoramento" correndo continuamente. */
function Pulso() {
  const d = "M0 40 H150 L170 40 L185 12 L205 68 L222 40 H330 L345 28 L360 52 L372 40 H600";
  return (
    <svg className="lg-pulse" viewBox="0 0 600 80" preserveAspectRatio="none" aria-hidden>
      <path className="base" d={d} />
      <path className="run" d={d} stroke="#ff8da1" />
    </svg>
  );
}

const item = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } } };

export default function Login() {
  const { login } = useAuth();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);
  const shake = useAnimationControls();
  const quieto = !!useReducedMotion();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErro("");
    const msg = await login(user, pass);
    if (msg) {
      setErro(msg);
      setBusy(false);
      if (!quieto) shake.start({ x: [0, -10, 10, -6, 6, 0], transition: { duration: 0.4 } });
    }
  }

  return (
    <div className="lg">
      <div className="lg-aurora" aria-hidden>
        <i /><i /><i />
      </div>
      <Fundo quieto={quieto} />

      <main className="lg-wrap">
        <motion.section className="lg-hero" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.12 } } }}>
          <motion.div variants={item} className="lg-logo"><Logo height={88} tema="escuro" /></motion.div>
          <motion.h1 variants={item}>
            Monitoramento de <span>Eventos Acidentais</span>
          </motion.h1>
          <motion.p variants={item}>Indicadores, taxas e registros de segurança do trabalho reunidos em um só lugar.</motion.p>
          <motion.div variants={item}><Pulso /></motion.div>
          <motion.ul variants={item} className="lg-feats">
            <li>Taxas TF, TFCA e TG</li>
            <li>Comparativo entre anos</li>
            <li>Registro de ocorrências</li>
          </motion.ul>
        </motion.section>

        <motion.div animate={shake} className="lg-side">
          <motion.form
            className="lg-card"
            onSubmit={submit}
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="lg-head">
              <h2>Bem-vindo</h2>
              <p>Entre com seu usuário e senha</p>
            </div>

            <div className="lg-field">
              <label htmlFor="u">Usuário</label>
              <div className="lg-input">
                <User size={17} />
                <input id="u" value={user} onChange={(e) => setUser(e.target.value)} placeholder="@usuario" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus />
              </div>
            </div>
            <div className="lg-field">
              <label htmlFor="p">Senha</label>
              <div className="lg-input">
                <Lock size={17} />
                <input id="p" type={show ? "text" : "password"} value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••" autoComplete="current-password" />
                <button type="button" className="lg-eye" onClick={() => setShow((s) => !s)} aria-label={show ? "Ocultar senha" : "Mostrar senha"}>
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            {erro && <div className="lg-err" role="alert">{erro}</div>}
            <motion.button className="lg-btn" disabled={busy || !user || !pass} whileTap={{ scale: 0.98 }}>
              <span>{busy ? "Entrando…" : "Entrar"}</span>
              <LogIn size={18} />
            </motion.button>
            <small className="lg-foot">Desenvolvido por Marcus Vinicius Silva Queiros</small>
          </motion.form>
        </motion.div>
      </main>
    </div>
  );
}
