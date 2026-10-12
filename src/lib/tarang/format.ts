type StatusTone = "success" | "info" | "neutral" | "warning" | "error";

import type { Level, ReqStatus } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Fixed "today" for the synthetic dataset. */
export const TODAY = "2026-10-12";

export function dateShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.UTC(+fromIso.slice(0, 4), +fromIso.slice(5, 7) - 1, +fromIso.slice(8, 10));
  const b = Date.UTC(+toIso.slice(0, 4), +toIso.slice(5, 7) - 1, +toIso.slice(8, 10));
  return Math.round((b - a) / 86400000);
}

export function usd(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

export function usdCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `$${Math.round(value / 1000)}k`;
  if (abs >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${Math.round(value)}`;
}

export const pct = (p: number) => `${Math.round(p * 100)}%`;

export const LEVEL_TONE: Record<Level, StatusTone> = { High: "error", Medium: "warning", Low: "info" };

export const STATUS_TONE: Record<ReqStatus, StatusTone> = { mandatory: "error", verify: "warning", voluntary: "neutral" };

export function toneForIndex(index: number): StatusTone {
  if (index >= 60) return "error";
  if (index >= 30) return "warning";
  return "success";
}

export const TONE_TEXT: Record<StatusTone, string> = {
  success: "text-success", info: "text-info", neutral: "text-neutral", warning: "text-warning", error: "text-error",
};

export const TONE_VAR: Record<StatusTone, string> = {
  success: "var(--feedback-success-icon)", info: "var(--feedback-info-icon)", neutral: "var(--feedback-neutral-icon)",
  warning: "var(--feedback-warning-icon)", error: "var(--feedback-error-icon)",
};
