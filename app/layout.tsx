import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// "Nostalgia" display + body typefaces — self-hosted (not next/font/google)
// so they never depend on reaching fonts.gstatic.com from whatever machine
// is running the dev server or build. Files live in public/fonts/.
const fraunces = localFont({
  variable: "--font-fraunces",
  src: [
    { path: "../public/fonts/fraunces-normal.woff2", weight: "400 600", style: "normal" },
    { path: "../public/fonts/fraunces-italic.woff2", weight: "400", style: "italic" },
  ],
});

const lora = localFont({
  variable: "--font-lora",
  src: [{ path: "../public/fonts/lora-normal.woff2", weight: "400 600", style: "normal" }],
});

export const metadata: Metadata = {
  title: "LoreBook — AI-powered study workspace for engineering students",
  description:
    "Turn PDFs, lecture recordings, and handwritten notes into a chat-able, quizzable, mastery-tracked study workspace.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LoreBook",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#f3ecda",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${lora.variable}`}
    >
      <body className="antialiased">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
