"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";

// Mirrors OPEN_COMMAND_PALETTE_EVENT in components/command/CommandPalette.tsx.
// Duplicated on purpose: importing it from there would pull cmdk back into
// every page's initial bundle, which is what this loader exists to avoid.
const OPEN_EVENT = "lorebook:open-command-palette";

/**
 * Keeps cmdk + the palette out of the initial bundle. The real palette is
 * fetched on the first Ctrl/Cmd+K (or trigger click), or once the browser is
 * idle, whichever comes first. If loading was caused by a user action, the
 * palette is opened as soon as it mounts so that first keypress isn't lost.
 */
export function LazyCommandPalette() {
  const [Palette, setPalette] = useState<ComponentType | null>(null);
  const openOnMount = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let started = false;

    function load() {
      if (started) return;
      started = true;
      import("@/components/command/CommandPalette")
        .then((m) => {
          if (!cancelled) setPalette(() => m.CommandPalette);
        })
        .catch((err) => {
          started = false;
          console.error("[command-palette] failed to load:", err);
        });
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        openOnMount.current = true;
        load();
      }
    }
    function onOpen() {
      openOnMount.current = true;
      load();
    }

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_EVENT, onOpen);

    const idle =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(load, { timeout: 5000 })
        : window.setTimeout(load, 3000);

    return () => {
      cancelled = true;
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_EVENT, onOpen);
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, []);

  // Once mounted, the real palette owns the shortcut. Child effects run
  // before this one, so its listener is already attached when we dispatch.
  useEffect(() => {
    if (Palette && openOnMount.current) {
      openOnMount.current = false;
      window.dispatchEvent(new Event(OPEN_EVENT));
    }
  }, [Palette]);

  return Palette ? <Palette /> : null;
}
