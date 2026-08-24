"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isSoundMuted, setSoundMuted, playFlip } from "@/lib/audio/sounds";

export function SoundToggle() {
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    setMuted(isSoundMuted());
  }, []);

  function toggle() {
    const next = !muted;
    setSoundMuted(next);
    setMuted(next);
    if (!next) playFlip();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={muted ? "Unmute UI sounds" : "Mute UI sounds"}
      title={muted ? "UI sounds off" : "UI sounds on"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--glass-border)",
        background: "var(--glass-bg)",
        color: "var(--muted-foreground)",
        cursor: "pointer",
      }}
    >
      {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
    </button>
  );
}
