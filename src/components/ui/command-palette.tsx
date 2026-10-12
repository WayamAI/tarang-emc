"use client";

/**
 * Global search. ⌘K / Ctrl+K. Pages and records together; picking either
 * navigates.
 */

import { CornerDownLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ALL_NAV_ITEMS } from "@/lib/navigation";
import { SEARCH_RECORDS, type SearchRecord } from "@/lib/search";

const MAX_PER_GROUP = 6;

const PAGE_RESULTS: SearchRecord[] = ALL_NAV_ITEMS.map((item) => ({
  id: `page-${item.href}`,
  group: "Pages",
  title: item.label,
  detail: item.href,
  href: item.href,
}));

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = [...PAGE_RESULTS, ...SEARCH_RECORDS];
    const matched = q
      ? pool.filter((r) => `${r.title} ${r.detail} ${r.group}`.toLowerCase().includes(q))
      : pool;
    const perGroup = new Map<string, number>();
    return matched.filter((r) => {
      const n = perGroup.get(r.group) ?? 0;
      perGroup.set(r.group, n + 1);
      return n < MAX_PER_GROUP;
    });
  }, [query]);

  function pick(result: SearchRecord | undefined) {
    if (!result) return;
    router.push(result.href);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 px-4 pt-[12vh]"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-label="Search"
        onMouseDown={(event) => event.stopPropagation()}
        className="flex max-h-[70vh] w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-muted bg-container shadow-lg"
      >
        <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-muted px-4">
          <Search size={15} strokeWidth={1.75} aria-hidden className="icon-tertiary" />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose();
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setCursor((c) => Math.min(c + 1, results.length - 1));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              }
              if (event.key === "Enter") pick(results[cursor]);
            }}
            placeholder="Search pages and records"
            className="h-full min-w-0 flex-1 bg-transparent text-body-md text-primary outline-none placeholder:text-quaternary"
          />
          <kbd className="rounded border border-muted px-1 text-caption text-quaternary">Esc</kbd>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-body-sm text-quaternary">Nothing matches that.</li>
          ) : null}
          {results.map((result, index) => {
            const firstOfGroup = index === 0 || results[index - 1].group !== result.group;
            return (
              <li key={result.id}>
                {firstOfGroup ? (
                  <p className="px-2.5 pt-2 pb-1 text-caption tracking-[0.08em] text-quaternary uppercase">
                    {result.group}
                  </p>
                ) : null}
                <button
                  type="button"
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => pick(result)}
                  className={[
                    "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left outline-none",
                    index === cursor ? "bg-action" : "",
                  ].join(" ")}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-label-sm text-primary">{result.title}</span>
                    <span className="block truncate text-caption text-quaternary">{result.detail}</span>
                  </span>
                  {index === cursor ? (
                    <CornerDownLeft size={13} strokeWidth={1.75} aria-hidden className="shrink-0 icon-quaternary" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
