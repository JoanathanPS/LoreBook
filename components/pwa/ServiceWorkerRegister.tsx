"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Offline caching is a progressive enhancement — fine if it fails.
      });
      return;
    }

    // A service worker registered during a previous `npm run dev` session
    // sticks around in the browser and will intercept navigations with a
    // cached response instead of hitting the live dev server — looks like
    // clicks doing nothing or the page reverting to an old build. Clean it
    // up whenever we're not in production.
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister());
    });
    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
    }
  }, []);

  return null;
}
