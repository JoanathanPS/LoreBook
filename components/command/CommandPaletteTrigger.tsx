"use client";

import { Search } from "lucide-react";
import { OPEN_COMMAND_PALETTE_EVENT } from "./CommandPalette";
import styles from "./CommandPaletteTrigger.module.css";

/** Visible, mouse/touch-accessible way to open the command palette — ⌘K alone isn't discoverable. */
export function CommandPaletteTrigger() {
  return (
    <button
      type="button"
      className={styles.trigger}
      onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT))}
      aria-label="Open search and command palette"
    >
      <Search size={13} />
      <span>Search</span>
      <kbd className={styles.kbd}>⌘K</kbd>
    </button>
  );
}
