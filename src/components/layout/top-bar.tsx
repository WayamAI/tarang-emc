"use client";

import { LogOut, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { CommandPalette } from "@/components/ui/command-palette";
import { APP } from "@/lib/app";
import { clearSession } from "@/lib/auth/session";
import { groupForPath, navItemForPath } from "@/lib/navigation";

import { SidebarMenuButton } from "./sidebar";

/**
 * Application top bar: where you are, what scope you are looking at, and the
 * global entry point (search).
 */
export function TopBar({ onMenu }: { onMenu?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Read from the browser without a state-in-effect round trip; the server
  // snapshot is `false` so the markup matches before hydration.
  const isMac = useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false,
  );

  const item = navItemForPath(pathname);
  const group = groupForPath(pathname);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function signOut() {
    clearSession();
    router.replace("/login");
  }

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-muted bg-page px-4 sm:gap-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          {onMenu ? <SidebarMenuButton onClick={onMenu} /> : null}
          {group && group.label !== item?.label ? (
            <span className="hidden shrink-0 text-caption tracking-[0.08em] text-quaternary uppercase sm:inline">
              {group.label}
            </span>
          ) : null}
          <h1 className="truncate font-display text-display-lg text-primary">
            {item?.label ?? APP.name}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-8 items-center gap-2 rounded-full border border-muted bg-action px-3 text-label-sm text-tertiary outline-none transition-colors duration-[180ms] hover:border-default hover:bg-raised-2 hover:text-secondary focus-visible:ring-2 focus-visible:ring-active"
          >
            <Search size={13} strokeWidth={1.75} aria-hidden />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden rounded border border-muted px-1 text-caption text-quaternary sm:inline">
              {isMac ? "⌘" : "Ctrl"}K
            </kbd>
          </button>

          <span className="hidden h-8 max-w-[260px] items-center gap-1.5 rounded-full border border-muted bg-action px-3 text-label-sm text-tertiary md:flex">
            <span className="truncate">{APP.scope}</span>
            <span className="text-quaternary">·</span>
            <span className="shrink-0 text-success">Live</span>
          </span>

          <button
            type="button"
            onClick={signOut}
            title={`${APP.operator.name} · sign out`}
            aria-label="Sign out"
            className="group flex size-8 items-center justify-center rounded-full bg-action-primary text-caption text-on-color outline-none transition-colors duration-[180ms] hover:bg-action-primary-hover focus-visible:ring-2 focus-visible:ring-active"
          >
            <span className="group-hover:hidden">{APP.operator.initials}</span>
            <LogOut size={14} strokeWidth={1.75} aria-hidden className="hidden group-hover:block" />
          </button>
        </div>
      </header>

      {paletteOpen ? <CommandPalette onClose={() => setPaletteOpen(false)} /> : null}
    </>
  );
}
