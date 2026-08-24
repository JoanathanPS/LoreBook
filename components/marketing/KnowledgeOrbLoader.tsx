"use client";

import dynamic from "next/dynamic";

const KnowledgeOrb = dynamic(
  () => import("./KnowledgeOrb").then((mod) => mod.KnowledgeOrb),
  { ssr: false },
);

export function KnowledgeOrbLoader() {
  return <KnowledgeOrb />;
}
