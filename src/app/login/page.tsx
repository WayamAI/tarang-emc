"use client";

import { Moon, SunMedium } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Logo } from "@/components/layout/logo";
import { useTheme } from "@/context/theme-context";
import { APP } from "@/lib/app";
import { credentialsMatch, DEMO_EMAIL, DEMO_PASSWORD, writeSession } from "@/lib/auth/session";

const STILL_SRC = "/brand/login-bg.jpg";

/**
 * Sign-in. The left panel is the product still (public/brand/login-bg.jpg,
 * prompt in prompts.md). Until it is rendered the panel is a graphite field
 * with an orange ember, so the surface never shows a broken image.
 */
export default function LoginPage() {
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [hasStill, setHasStill] = useState(false);

  // Probe rather than render-and-hope: a 404 that lands before hydration
  // never reaches an onError handler.
  useEffect(() => {
    const img = new Image();
    img.onload = () => setHasStill(img.naturalWidth > 0);
    img.src = STILL_SRC;
    return () => {
      img.onload = null;
    };
  }, []);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!credentialsMatch(email, password)) {
      setError("That email or password does not match the demo operator.");
      return;
    }
    setBusy(true);
    setError(undefined);
    writeSession();
    router.replace(APP.home);
  }

  function fillDemo() {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setError(undefined);
  }

  return (
    <div className="flex h-full min-h-0 bg-page">
      <aside className="login-still relative hidden min-w-0 flex-[1.4] overflow-hidden lg:block">
        {hasStill ? (
          <img
            src={STILL_SRC}
            alt=""
            className="absolute inset-0 size-full object-cover object-center"
          />
        ) : (
          <span
            aria-hidden
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] text-[clamp(96px,16vw,220px)] leading-none whitespace-nowrap text-white/[0.07] select-none"
          >
            {APP.devanagari}
          </span>
        )}
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-r from-transparent to-page" />
        <div className="absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute right-10 bottom-10 left-10 max-w-[36rem]">
          <p className="font-display text-display-2xl text-white sm:text-display-3xl">
            {APP.loginHeadline}
          </p>
          <p className="mt-3 max-w-[46ch] text-body-md text-white/75">{APP.loginSubline}</p>
        </div>
      </aside>

      <section className="flex min-h-0 w-full shrink-0 flex-col overflow-y-auto border-muted bg-page lg:w-[min(28rem,42%)] lg:border-l">
        <div className="flex items-center justify-between px-8 pt-6">
          <Logo wordmark href={false} />
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light" : "Switch to dark"}
            className="flex size-8 items-center justify-center rounded-full bg-action icon-tertiary outline-none transition-colors duration-[180ms] hover:bg-raised-2 hover:icon-secondary focus-visible:ring-2 focus-visible:ring-active"
          >
            {isDark ? (
              <SunMedium size={16} strokeWidth={1.75} aria-hidden />
            ) : (
              <Moon size={16} strokeWidth={1.75} aria-hidden />
            )}
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col justify-center px-8 py-10">
          <p className="text-caption tracking-[0.08em] text-quaternary uppercase">
            {APP.devanagari} · {APP.meaning}
          </p>
          <h1 className="mt-2 font-display text-display-xl text-primary">Sign in</h1>
          <p className="mt-1.5 text-body-md text-tertiary">{APP.loginNote}</p>

          <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-caption tracking-[0.08em] text-quaternary uppercase">Email</span>
              <input
                type="email"
                name="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={DEMO_EMAIL}
                className="h-11 w-full rounded-full border border-muted bg-action px-4 text-body-md text-primary outline-none placeholder:text-quaternary focus-visible:border-default focus-visible:ring-2 focus-visible:ring-active"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-caption tracking-[0.08em] text-quaternary uppercase">Password</span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="h-11 w-full rounded-full border border-muted bg-action px-4 text-body-md text-primary outline-none placeholder:text-quaternary focus-visible:border-default focus-visible:ring-2 focus-visible:ring-active"
              />
            </label>

            {error ? <p className="text-body-sm text-error">{error}</p> : null}

            <button
              type="submit"
              disabled={busy}
              className="mt-1 h-11 rounded-full bg-action-primary text-label-md text-on-color outline-none transition-colors duration-[180ms] hover:bg-action-primary-hover focus-visible:ring-2 focus-visible:ring-active disabled:bg-action-primary-disabled"
            >
              {busy ? "Entering…" : `Enter ${APP.name}`}
            </button>
          </form>

          <p className="mt-6 text-body-sm text-quaternary">
            Demo operator{" "}
            <button
              type="button"
              onClick={fillDemo}
              className="text-secondary underline-offset-2 outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-active"
            >
              {DEMO_EMAIL}
            </button>
            <span className="text-quaternary"> · </span>
            <span className="tabular text-tertiary">{DEMO_PASSWORD}</span>
          </p>
          <p className="mt-10 text-caption text-quaternary">A Wayam AI accelerator · synthetic demo data</p>
        </div>
      </section>
    </div>
  );
}
