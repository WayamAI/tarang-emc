"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "./app-shell";

/** Login is a full-bleed surface. Everything else sits in the command chrome. */
export function ShellGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") return children;
  return <AppShell>{children}</AppShell>;
}
