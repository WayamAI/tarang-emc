"use client";

import Link from "next/link";

import { APP } from "@/lib/app";

/**
 * Product brand. The mark is the orange Wayam tile; the wordmark is the
 * Sanskrit product name set in the display face with one orange letter.
 */
export function Logo({
  wordmark = false,
  className = "",
  href = APP.home,
}: {
  wordmark?: boolean;
  className?: string;
  /** Pass `false` on the login surface so the mark is not a dead link. */
  href?: string | false;
}) {
  const mark = (
    <>
      <img
        src="/brand/mark.svg"
        alt=""
        width={32}
        height={32}
        className="size-8 shrink-0 rounded-[10px]"
      />
      {wordmark ? (
        <span
          aria-label={APP.name}
          className="min-w-0 truncate font-display text-[15px] leading-none tracking-[0.2em] text-primary uppercase"
        >
          {APP.name.split("").map((letter, index) => (
            <span key={index} className={index === APP.accentIndex ? "text-brand" : undefined}>
              {letter}
            </span>
          ))}
        </span>
      ) : null}
    </>
  );

  const frame = `flex min-w-0 items-center gap-2.5 ${className}`;

  if (!href) {
    return <span className={frame}>{mark}</span>;
  }

  return (
    <Link
      href={href}
      aria-label={`${APP.name} home`}
      className={`${frame} outline-none focus-visible:ring-2 focus-visible:ring-active`}
    >
      {mark}
    </Link>
  );
}
