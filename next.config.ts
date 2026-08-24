import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist (via pdf-parse) dynamically resolves its worker file at
  // runtime — Turbopack can't trace that, so keep it un-bundled and let
  // Node require it natively instead.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
