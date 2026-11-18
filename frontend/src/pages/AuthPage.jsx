import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Eye, EyeOff, Radio, Shuffle } from "lucide-react";
import { login, setToken, signup } from "../api";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Logo } from "../ui/logo";
import { Notice } from "../ui/section";
import { waveformFor } from "../features/now-playing/signature";
import { cn } from "../lib/utils";

const WAVE = waveformFor({ track_id: "echotrack-entrada", energy: 0.72, loudness: -7, danceability: 0.7, tempo: 116 }, 56);

/** Entrar e criar conta — tema "papel": creme, tinta e serifa. */
export function AuthPage({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", consent: false });
  const [show, setShow] = useState(false);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const reduce = useReducedMotion();
  const isSignup = mode === "signup";
  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const data = isSignup ? await signup(form) : await login({ email: form.email, password: form.password });
      setToken(data.token);
      onAuth(data.user);
    } catch (err) {
      setError(err.kind === "offline" ? "Não foi possível falar com o servidor. Confira se a API está rodando." : err.message);
      setSending(false);
    }
  }

  const switchMode = () => {
    setMode(isSignup ? "login" : "signup");
    setError(null);
  };

  const field = "h-13 rounded-pill bg-surface-1 px-5 shadow-none ring-border focus-visible:bg-bg";

  return (
    <div className="theme-paper min-h-dvh">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 pt-6 sm:px-10">
        <Logo />
        <button type="button" onClick={switchMode} className="rounded-pill px-4 py-2 text-small font-medium text-text-1 ring-1 ring-border transition-colors duration-(--duration-fast) hover:bg-surface-2">
          {isSignup ? "Já tenho conta" : "Criar conta"}
        </button>
      </header>

      <main className="mx-auto grid max-w-7xl items-center gap-16 px-6 py-12 sm:px-10 lg:min-h-[calc(100dvh-5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:py-10">
        <motion.section
          key={mode}
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="grid w-full max-w-md gap-8 justify-self-center lg:justify-self-start"
        >
          <div className="grid gap-4">
            <p className="text-small text-text-2">{isSignup ? "Leva um minuto" : "Que bom te ver de novo"}</p>
            <h1 className="font-serif text-[clamp(2.75rem,2rem+3.5vw,4.5rem)] leading-[1] tracking-[-0.02em] text-text-1">
              {isSignup ? (
                <>
                  Crie sua conta e <em>ouça</em> diferente.
                </>
              ) : (
                <>
                  Música que <em>soa</em> como você.
                </>
              )}
            </h1>
            <p className="text-body text-text-2">
              {isSignup
                ? "Depois, quatro perguntas rápidas ensinam o seu gosto para a IA."
                : "Entre para continuar de onde parou."}
            </p>
          </div>

          {error && <Notice tone="danger">{error}</Notice>}

          <form className="grid gap-4" onSubmit={submit} noValidate>
            {isSignup && (
              <label className="grid gap-2">
                <span className="pl-5 text-small text-text-2">Como podemos te chamar?</span>
                <Input className={field} type="text" autoComplete="given-name" value={form.name} onChange={update("name")} placeholder="Seu nome" required />
              </label>
            )}
            <label className="grid gap-2">
              <span className="pl-5 text-small text-text-2">E-mail</span>
              <Input className={field} type="email" autoComplete="email" value={form.email} onChange={update("email")} placeholder="nome@dominio.com" required />
            </label>
            <label className="grid gap-2">
              <span className="pl-5 text-small text-text-2">
                Senha{isSignup && <span className="text-text-3"> · pelo menos 8 caracteres</span>}
              </span>
              <span className="relative block">
                <Input
                  className={cn(field, "pr-14")}
                  type={show ? "text" : "password"}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  value={form.password}
                  onChange={update("password")}
                  placeholder="Sua senha"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? "Esconder senha" : "Mostrar senha"}
                  className="absolute top-1/2 right-2.5 grid size-9 -translate-y-1/2 place-items-center rounded-pill text-text-2 hover:bg-surface-3 hover:text-text-1"
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </span>
            </label>
            {isSignup && (
              <label className="flex items-start gap-3 rounded-lg bg-surface-1 p-4 text-small text-text-2">
                <input type="checkbox" checked={form.consent} onChange={update("consent")} className="mt-0.5 size-4 shrink-0 accent-(--text-1)" />
                <span>
                  Concordo que o EchoTrack guarde meu e-mail e minhas respostas do questionário para personalizar as
                  recomendações. Posso apagar minha conta quando quiser.
                </span>
              </label>
            )}
            <Button type="submit" variant="primary" size="lg" disabled={sending} className="mt-2 h-13 w-full">
              {sending ? "Aguarde…" : isSignup ? "Criar conta" : "Entrar"}
            </Button>
          </form>

          <p className="text-small text-text-2">
            {isSignup ? "Já tem uma conta?" : "Ainda não tem conta?"}{" "}
            <button type="button" onClick={switchMode} className="font-semibold text-text-1 underline decoration-border-strong underline-offset-4 hover:decoration-text-1">
              {isSignup ? "Entrar" : "Criar conta"}
            </button>
          </p>
        </motion.section>

        <Showcase reduce={reduce} />
      </main>
    </div>
  );
}

/** Vitrine ao lado do formulário: o que o EchoTrack faz, mostrado em vez de dito. */
function Showcase({ reduce }) {
  return (
    <aside aria-label="Como o EchoTrack recomenda" className="relative hidden overflow-hidden rounded-xl bg-surface-2 p-10 lg:grid lg:min-h-[36rem] lg:content-between">
      <p className="max-w-sm font-serif text-[2rem] leading-[1.1] text-text-1">
        Uma música entra. <em className="text-text-2">Uma playlist sai</em> — e cada escolha diz por quê.
      </p>

      <div aria-hidden="true" className="my-10 flex h-24 items-center gap-1">
        {WAVE.map((h, i) => (
          <motion.span
            key={i}
            className={cn("flex-1 rounded-pill", i < 20 ? "bg-text-1/25" : "bg-text-1")}
            style={{ height: `${Math.round(h * 100)}%` }}
            initial={reduce ? false : { scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.5, delay: reduce ? 0 : 0.2 + i * 0.012, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </div>

      <div className="grid gap-3">
        <ExampleCard title="Sorry" artist="Justin Bieber" pct={86} because="Porque você escolheu Watermelon Sugar" reduce={reduce} delay={0.5} />
        <ExampleCard title="Out of Time" artist="The Weeknd" pct={83} because="Para variar, sem fugir do clima" diverse reduce={reduce} delay={0.65} className="ml-10" />
      </div>
    </aside>
  );
}

function ExampleCard({ title, artist, pct, because, diverse, reduce, delay, className }) {
  const Icon = diverse ? Shuffle : Radio;
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: reduce ? 0 : delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn("flex items-center gap-4 rounded-lg bg-bg p-4 shadow-3", className)}
    >
      <span aria-hidden="true" className="size-12 shrink-0 rounded-md bg-ai-surface" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-small font-semibold text-text-1">
          {title} <span className="font-regular text-text-2">· {artist}</span>
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-caption text-text-2 tracking-normal">
          <Icon aria-hidden="true" className="size-3.5 text-ai" />
          {because}
        </span>
      </span>
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className="relative h-1.5 w-10 overflow-hidden rounded-pill bg-surface-3">
          <span className="absolute inset-y-0 left-0 rounded-pill bg-ai" style={{ width: `${pct}%` }} />
        </span>
        <span className="text-small font-semibold tabular text-text-1">{pct}%</span>
      </span>
    </motion.div>
  );
}
