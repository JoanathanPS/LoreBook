import { CommandPalette } from "@/components/command/CommandPalette";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <CommandPalette />
    </>
  );
}
