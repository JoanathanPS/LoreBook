"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  LayoutDashboard,
  Library,
  MessagesSquare,
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

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SearchData>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
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
  }, []);

  useEffect(() => {
    if (open && !loaded) {
      fetch("/api/search")
        .then((res) => res.json())
        .then((json) => {
          setData(json);
          setLoaded(true);
        })
        .catch(() => {});
    }
  }, [open, loaded]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to a course, document, concept, or page…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

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
