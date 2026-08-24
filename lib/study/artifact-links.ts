const BASE_BY_KIND: Record<string, string> = {
  summary: "/study/summary",
  formula_sheet: "/study/summary",
  flashcard_deck: "/study/flashcards",
  quiz: "/study/quiz",
  reel: "/reels",
};

export function artifactHref(kind: string, id: string): string {
  return `${BASE_BY_KIND[kind] ?? "/study/summary"}/${id}`;
}
