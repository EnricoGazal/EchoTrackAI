import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Eye, EyeOff, Radio, Shuffle } from "lucide-react";
import { login, setToken, signup } from "../api";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Logo } from "../ui/logo";
import { Notice } from "../ui/section";
import { AiMark } from "../features/ai/AiLayer";
import { waveformFor } from "../features/now-playing/signature";
import { cn } from "../lib/utils";

const WAVE = waveformFor({ track_id: "echotrack-entrada", energy: 0.72, loudness: -7, danceability: 0.7, tempo: 116 }, 56);

/**
 * Entrar e criar conta, com o mesmo visual do app: fundo escuro, vidro e a
 * fonte dos títulos. Na primeira visita abre em "Criar conta"; depois de
 * "Sair", em "Entrar".
 */
export function AuthPage({ onAuth, initialMode = "signup" }) {
  const [mode, setMode] = useState(initialMode);
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

  const field = "h-12 rounded-pill bg-surface-1/70 px-5 shadow-none ring-(--glass-ring) hover:ring-border focus-visible:bg-surface-2";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 pt-6 sm:px-10">
        <Logo />
        <Button variant="ghost" size="md" onClick={switchMode} className="text-text-1 ring-1 ring-(--glass-ring)">
          {isSignup ? "Já tenho conta" : "Criar conta"}
        </Button>
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-12 px-6 py-12 sm:px-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-20 lg:py-6">
        <motion.section
          key={mode}
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="grid w-full max-w-md gap-7 justify-self-center lg:justify-self-start"
        >
          <div className="grid gap-3">
            <p className="text-small text-text-2">{isSignup ? "Leva um minuto" : "Entre para continuar de onde parou"}</p>
            <h1 className="font-display-tight text-display font-heavy text-balance">
              {isSignup ? "Crie sua conta" : "Que bom te ver de novo"}
              <span className="text-brand">.</span>
            </h1>
            {isSignup && <p className="text-body text-text-2">Depois, quatro perguntas rápidas ensinam o seu gosto para a IA.</p>}
          </div>

          <div className="grid gap-5 rounded-xl bg-(--rail-bg) p-6 shadow-3 ring-1 ring-(--rail-ring) backdrop-blur-(--rail-blur)">
            {error && <Notice tone="danger">{error}</Notice>}

            <form className="grid gap-3.5" onSubmit={submit} noValidate>
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
                    className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-pill text-text-2 transition-colors duration-(--duration-fast) hover:bg-surface-3 hover:text-text-1"
                  >
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </span>
              </label>
              {isSignup && (
                <label className="flex cursor-pointer items-start gap-3 px-1 pt-1 text-small text-text-2">
                  <input type="checkbox" checked={form.consent} onChange={update("consent")} className="mt-0.5 size-4 shrink-0 accent-(--brand)" />
                  <span>
                    Concordo que o EchoTrack guarde meu e-mail e minhas respostas do questionário para personalizar as
                    recomendações. Posso apagar minha conta quando quiser.
                  </span>
                </label>
              )}
              <Button type="submit" variant="primary" size="lg" disabled={sending} className="mt-2 w-full">
                {sending ? "Aguarde…" : isSignup ? "Criar conta" : "Entrar"}
                {!sending && <ArrowRight aria-hidden="true" />}
              </Button>
            </form>
          </div>

          <p className="text-small text-text-2">
            {isSignup ? "Já tem uma conta?" : "Ainda não tem conta?"}{" "}
            <button type="button" onClick={switchMode} className="font-semibold text-text-1 underline decoration-border-strong underline-offset-4 transition-colors duration-(--duration-fast) hover:decoration-text-1">
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
    <aside
      aria-label="Como o EchoTrack recomenda"
      className="relative hidden overflow-hidden rounded-xl bg-(--rail-bg) p-9 shadow-3 ring-1 ring-(--rail-ring) backdrop-blur-(--rail-blur) lg:grid lg:min-h-[32rem] lg:content-between"
    >
      {/* brilho ciano atrás da onda: o modelo "ouvindo" */}
      <span aria-hidden="true" className="pointer-events-none absolute -right-24 top-1/3 size-96 rounded-full bg-(--glow-ai) blur-3xl" />

      <div className="relative grid justify-items-start gap-6">
        <AiMark>Como o EchoTrack AI recomenda</AiMark>
        <p className="grid font-display-tight text-title font-heavy">
          <span className="text-text-1">Uma música entra.</span>
          <span className="text-text-3">Uma playlist sai.</span>
        </p>
        <p className="max-w-sm text-body text-text-2">O modelo compara o som de cada faixa com quase 90 mil músicas, e cada escolha diz por quê.</p>
      </div>

      <div aria-hidden="true" className="relative my-8 flex h-20 items-center gap-1">
        {WAVE.map((h, i) => (
          <motion.span
            key={i}
            className={cn("flex-1 rounded-pill", i < 20 ? "bg-text-1/20" : "bg-ai/85")}
            style={{ height: `${Math.round(h * 100)}%` }}
            initial={reduce ? false : { scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.5, delay: reduce ? 0 : 0.2 + i * 0.012, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </div>

      <div className="relative grid gap-3">
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
      className={cn("flex items-center gap-4 rounded-lg bg-surface-1/80 p-4 shadow-2 ring-1 ring-(--glass-ring)", className)}
    >
      <span aria-hidden="true" className={cn("size-12 shrink-0 rounded-md bg-linear-135 to-surface-3", diverse ? "from-ai/35" : "from-brand/40")} />
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
