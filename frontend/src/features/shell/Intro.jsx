import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Logo } from "../../ui/logo";

const KEY = "echotrack-abertura";
const EASE = [0.22, 1, 0.36, 1];
const HOLD_MS = 2600; // tempo total na tela antes de revelar o app
const HOLD_REDUCED_MS = 1600;

/** A abertura aparece uma vez por visita (aba do navegador). */
export function shouldShowIntro() {
  try {
    return sessionStorage.getItem(KEY) !== "1";
  } catch {
    return true;
  }
}

const LINES = [
  { text: "Música escolhida pelo som.", className: "text-text-1" },
  { text: "Não pela audiência.", className: "text-text-3" },
];

/**
 * Abertura do site: o slogan em foco, sozinho na tela, e depois o app
 * aparece por trás. Qualquer clique ou tecla pula.
 */
export function Intro({ onDone }) {
  const reduce = useReducedMotion();
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };

  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      // sem armazenamento: a abertura volta na próxima visita, sem problema
    }
    const timer = setTimeout(finish, reduce ? HOLD_REDUCED_MS : HOLD_MS);
    const onKey = () => finish();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Abertura do EchoTrack"
      onClick={finish}
      initial={{ opacity: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.03, filter: "blur(10px)" }}
      transition={{ duration: reduce ? 0.2 : 0.7, ease: EASE }}
      className="fixed inset-0 z-[80] grid cursor-pointer place-items-center bg-bg bg-(image:--app-glow) px-6"
    >
      <div className="grid justify-items-center gap-10 text-center">
        <motion.span
          initial={reduce ? false : { opacity: 0, scale: 0.85, rotate: -40 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.9, ease: EASE }}
        >
          <Logo withName={false} className="[&>svg]:size-12" />
        </motion.span>

        <p className="grid font-display-tight text-hero-m font-heavy text-balance">
          {LINES.map((line, i) => (
            <span key={line.text} className="block overflow-hidden pb-[0.08em]">
              <motion.span
                className={`block ${line.className}`}
                initial={reduce ? false : { y: "105%" }}
                animate={{ y: 0 }}
                transition={{ duration: 0.9, delay: 0.15 + i * 0.16, ease: EASE }}
              >
                {line.text}
              </motion.span>
            </span>
          ))}
        </p>

        {/* Fio ciano: o modelo "lendo" o som enquanto o app carrega por trás */}
        <span aria-hidden="true" className="block h-0.5 w-40 overflow-hidden rounded-pill bg-(--glass-track)">
          <motion.span
            className="block h-full origin-left rounded-pill bg-ai"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: (reduce ? HOLD_REDUCED_MS : HOLD_MS) / 1000 - 0.2, delay: 0.2, ease: "linear" }}
          />
        </span>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          finish();
        }}
        className="absolute right-6 bottom-6 rounded-pill px-4 py-2 text-small text-text-2 transition-colors duration-(--duration-fast) hover:bg-surface-2 hover:text-text-1"
      >
        Pular
      </button>
    </motion.div>
  );
}
