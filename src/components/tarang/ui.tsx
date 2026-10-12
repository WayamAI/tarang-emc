"use client";

/** Small Tarang building blocks in the Wayam token style. */

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";

import { Mark } from "@/components/ui/mark";
import { Select, StatusBadge } from "@/components/ui/primitives";
import type { MarkDef } from "@/lib/marks";
import { useTarang } from "@/lib/tarang/context";
import { LEVEL_TONE, TONE_VAR } from "@/lib/tarang/format";
import type { Level } from "@/lib/tarang/types";

export function M({ mark, size = 28, className }: { mark: MarkDef; size?: number; className?: string }) {
  return <Mark id={mark.id} icon={mark.icon} size={size} className={className} />;
}

const BTN_BASE =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-label-sm outline-none transition-colors duration-[180ms] focus-visible:ring-2 focus-visible:ring-active disabled:pointer-events-none disabled:opacity-40";

export const BTN = {
  primary: `${BTN_BASE} bg-action-primary text-on-color hover:bg-action-primary-hover`,
  secondary: `${BTN_BASE} border border-muted bg-action text-secondary hover:border-default hover:bg-raised-2 hover:text-primary`,
  ghost: `${BTN_BASE} text-tertiary hover:bg-action-tertiary-hover hover:text-primary`,
};

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BTN }) {
  return <button type="button" {...props} className={`${BTN[variant]} ${className}`} />;
}

export function LinkButton({
  href,
  variant = "secondary",
  children,
  className = "",
}: {
  href: string;
  variant?: keyof typeof BTN;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={`${BTN[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-caption tracking-[0.08em] text-quaternary uppercase ${className}`}>{children}</p>;
}

export function LevelBadge({ level }: { level: Level | undefined }) {
  if (!level) return <StatusBadge tone="success">Cleared</StatusBadge>;
  return <StatusBadge tone={LEVEL_TONE[level]}>{level}</StatusBadge>;
}

/** Score as a number plus a thin bar on the 0 to 100 scale. */
export function ScoreBar({ score, level, width = "w-16" }: { score: number; level?: Level; width?: string }) {
  const tone = level ? LEVEL_TONE[level] : "success";
  return (
    <span className="inline-flex items-center gap-2">
      <span className="w-7 text-right text-body-sm tabular text-primary">{score}</span>
      <span className={`block h-1.5 ${width} overflow-hidden rounded-full bg-raised-2`}>
        <span className="block h-full rounded-full" style={{ width: `${score}%`, background: TONE_VAR[tone] }} />
      </span>
    </span>
  );
}

/** Big telemetry figure with a caption. */
export function Figure({
  label,
  value,
  unit,
  tone = "text-primary",
  hint,
}: {
  label: string;
  value: string | number;
  unit?: string;
  tone?: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <Label>{label}</Label>
      <p className={`mt-1 font-display text-display-xl tabular ${tone}`}>
        {value}
        {unit ? <span className="ml-1 font-sans text-body-sm text-quaternary">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-0.5 truncate text-caption text-quaternary">{hint}</p> : null}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-md px-1.5 py-1.5 text-left outline-none transition-colors duration-[150ms] hover:bg-raised focus-visible:ring-2 focus-visible:ring-active"
    >
      <span className="min-w-0">
        <span className="block truncate text-body-sm text-secondary">{label}</span>
        {hint ? <span className="block truncate text-caption text-quaternary">{hint}</span> : null}
      </span>
      <span
        className={`relative h-4.5 w-8 shrink-0 rounded-full border transition-colors duration-[150ms] ${checked ? "border-transparent bg-action-primary" : "border-default bg-raised-2"}`}
      >
        <span
          className={`absolute top-1/2 size-3 -translate-y-1/2 rounded-full transition-[left] duration-[150ms] ${checked ? "left-[16px] bg-container" : "left-[2px] bg-quaternary"}`}
        />
      </span>
    </button>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="tablist" className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-full border border-muted bg-action p-0.5">
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-label-sm outline-none transition-colors duration-[150ms] focus-visible:ring-2 focus-visible:ring-active ${active ? "bg-action-primary text-on-color" : "text-tertiary hover:text-primary"}`}
          >
            {tab.label}
            {tab.count !== undefined ? <span className="tabular opacity-70">{tab.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Right-hand detail drawer. The only surface besides popovers that casts a shadow. */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = "w-[min(30rem,100vw)]",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-page opacity-70" />
      <aside
        role="dialog"
        aria-label={title}
        className={`relative flex h-full ${width} flex-col border-l border-muted bg-container shadow-lg`}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-muted px-4 py-3">
          <div className="min-w-0">
            <h3 className="truncate text-heading-sm text-primary">{title}</h3>
            {subtitle ? <div className="mt-0.5 text-body-sm text-tertiary">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="shrink-0 rounded-full p-1 text-tertiary outline-none transition-colors duration-[150ms] hover:bg-action-tertiary-hover hover:text-primary focus-visible:ring-2 focus-visible:ring-active"
          >
            <X size={15} strokeWidth={1.75} aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer ? <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-muted px-4 py-3">{footer}</footer> : null}
      </aside>
    </div>
  );
}

export const SELECT_CLASS =
  "h-8 max-w-full rounded-full border border-muted bg-action text-label-sm text-secondary outline-none transition-colors duration-[150ms] hover:border-default focus-visible:ring-2 focus-visible:ring-active";

/** Design scope selector shared by every design-scoped page. */
export function DesignPicker({ value, onChange }: { value?: string; onChange?: (id: string) => void }) {
  const { designs, activeId, setActiveId } = useTarang();
  return (
    <Select
      aria-label="Design in scope"
      value={value ?? activeId}
      onChange={(event) => (onChange ?? setActiveId)(event.target.value)}
      className={SELECT_CLASS}
    >
      {designs.map((d) => (
        <option key={d.id} value={d.id}>
          {d.product} {d.version} · {d.note}
        </option>
      ))}
    </Select>
  );
}

export function KeyValue({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="shrink-0 text-body-sm text-tertiary">{k}</span>
      <span className="min-w-0 truncate text-right text-body-sm tabular text-secondary">{v}</span>
    </div>
  );
}

/** Confidence meter for agent observations. */
export function Confidence({ value }: { value: number }) {
  return (
    <div className="min-w-[120px]">
      <div className="flex items-baseline justify-between gap-2">
        <Label>Confidence</Label>
        <span className="text-body-sm tabular text-primary">{Math.round(value * 100)}%</span>
      </div>
      <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-raised-2">
        <span className="block h-full rounded-full bg-info" style={{ width: `${value * 100}%` }} />
      </span>
    </div>
  );
}
