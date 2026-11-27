"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  LayoutDashboard,
  Library,
  MessagesSquare,
  RotateCw,
  Share2,
  Sparkles,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { artifactHref } from "@/lib/study/artifact-links";

interface SearchData {
  courses: { id: string; name: string }[];
  documents: { id: string; title: string; course_id: string }[];
  concepts: { id: string; name: string; course_id: string }[];
  artifacts: { id: string; title: string; kind: string; course_id: string }[];
}

const EMPTY: SearchData = { courses: [], documents: [], concepts: [], artifacts: [] };
export const OPEN_COMMAND_PALETTE_EVENT = "lorebook:open-command-palette";

type LoadState = "idle" | "loading" | "ready" | "error";

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpenState] = useState(false);
  const [data, setData] = useState<SearchData>(EMPTY);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const openRef = useRef(false);
  const requestRef = useRef<AbortController | null>(null);

  // Refetch every time the palette opens so new courses, documents and
  // generated material show up; keep the previous results visible meanwhile.
  const load = useCallback(() => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoadState("loading");
    fetch("/api/search", { cache: "no-store", signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as SearchData;
      })
      .then((json) => {
        setData({ ...EMPTY, ...json });
        setLoadState("ready");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        console.error("command palette search failed", err);
        setLoadState("error");
      });
  }, []);

  const setOpen = useCallback(
    (next: boolean) => {
      if (next && !openRef.current) load();
      if (!next) requestRef.current?.abort();
      openRef.current = next;
      setOpenState(next);
    },
    [load],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!openRef.current);
      }
    }
    function onOpenEvent() {
      setOpen(true);
    }
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenEvent);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenEvent);
    };
  }, [setOpen]);

  useEffect(() => () => requestRef.current?.abort(), []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to a course, document, concept, or page…" />
      <CommandList>
        <CommandEmpty>{loadState === "loading" ? "Searching…" : "No results."}</CommandEmpty>

        {loadState === "error" && (
          <CommandGroup heading="Search unavailable">
            <CommandItem value="retry search couldn't load" onSelect={load}>
              <RotateCw />
              Couldn&apos;t load your courses and material — retry
            </CommandItem>
          </CommandGroup>
        )}

        <CommandGroup heading="Go to">
          <CommandItem onSelect={() => go("/library")}>
            <Library />
            Library
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard")}>
            <LayoutDashboard />
            Dashboard
          </CommandItem>
        </CommandGroup>

        {data.courses.length > 0 && (
          <CommandGroup heading="Courses">
            {data.courses.map((c) => (
              <CommandItem key={c.id} value={`course ${c.name}`} onSelect={() => go(`/chat/${c.id}`)}>
                <MessagesSquare />
                {c.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {data.concepts.length > 0 && (
          <CommandGroup heading="Concepts">
            {data.concepts.map((c) => (
              <CommandItem
                key={c.id}
                value={`concept ${c.name}`}
                onSelect={() => go(`/graph/${c.course_id}`)}
              >
                <Share2 />
                {c.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {data.artifacts.length > 0 && (
          <CommandGroup heading="Study material">
            {data.artifacts.map((a) => (
              <CommandItem
                key={a.id}
                value={`artifact ${a.title}`}
                onSelect={() => go(artifactHref(a.kind, a.id))}
              >
                <Sparkles />
                {a.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {data.documents.length > 0 && (
          <CommandGroup heading="Documents">
            {data.documents.map((d) => (
              <CommandItem
                key={d.id}
                value={`document ${d.title}`}
                onSelect={() => go("/library")}
              >
                <FileText />
                {d.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
