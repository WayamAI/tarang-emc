"use client";

import { Box, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Whether the render for a mark id exists, probed once per id and shared by
 * every instance so a list of marks does not flash on each mount.
 */
const probed = new Map<string, boolean>();
const pending = new Map<string, Promise<boolean>>();

function probe(src: string): Promise<boolean> {
  const known = probed.get(src);
  if (known !== undefined) return Promise.resolve(known);
  let request = pending.get(src);
  if (!request) {
    request = new Promise<boolean>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth > 0);
      img.onerror = () => resolve(false);
      img.src = src;
    }).then((ok) => {
      probed.set(src, ok);
      pending.delete(src);
      return ok;
    });
    pending.set(src, request);
  }
  return request;
}

/**
 * Decorative 3D mark. Empty alt the adjacent label is the name.
 *
 * Renders /images/marks/{id}.png (see prompts.md for the Flow prompt behind
 * each id). The Lucide glyph on an orange tile is what paints first and what
 * stays if the render has not been generated, so a screen never shows a
 * broken image.
 */
export function Mark({
  id,
  icon: Icon = Box,
  size = 40,
  className = "",
}: {
  id: string;
  /** Glyph shown until the 3D render for `id` is generated. */
  icon?: LucideIcon;
  size?: number;
  className?: string;
}) {
  const src = `/images/marks/${id}.png`;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    probe(src).then((ok) => {
      if (live) setReady(ok);
    });
    return () => {
      live = false;
    };
  }, [src]);

  if (!ready) {
    return (
      <span
        aria-hidden
        style={{ width: size, height: size }}
        className={`pointer-events-none flex shrink-0 items-center justify-center rounded-[28%] bg-warning-surface text-brand ${className}`}
      >
        <Icon size={Math.round(size * 0.5)} strokeWidth={1.75} />
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      draggable={false}
      className={`pointer-events-none shrink-0 select-none object-contain ${className}`}
    />
  );
}
