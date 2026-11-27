import { LazyCommandPalette } from "@/components/app/LazyCommandPalette";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <LazyCommandPalette />
    </>
  );
}
