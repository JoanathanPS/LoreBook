"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";

/**
 * Landing-page-only motion controller (Phase 8, §6): Lenis smooth scroll,
 * GSAP headline/section reveals, magnetic-cursor CTA. Renders nothing —
 * just wires animation onto the data-anim/data-reveal/data-magnetic
 * attributes already present in Hero/FeaturesBento/HowItWorks.
 *
 * No-ops entirely under prefers-reduced-motion — the page is fully usable
 * and readable without any of this running.
 */
export function LandingMotion() {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;

    gsap.registerPlugin(ScrollTrigger, SplitText);

    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // Lenis owns scroll position via its own rAF loop, so the browser's
    // native hash-jump (on load or on click) races it and leaves the page
    // rendered at the wrong transform — a black gap above the content.
    // Route every in-page hash link through lenis.scrollTo instead.
    const NAV_OFFSET = -72;

    const onAnchorClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a[href^="#"]');
      if (!anchor) return;
      const id = anchor.getAttribute("href");
      if (!id || id === "#" || !document.querySelector(id)) return;
      e.preventDefault();
      lenis.scrollTo(id, { offset: NAV_OFFSET });
    };
    document.addEventListener("click", onAnchorClick);

    let loadListener: (() => void) | null = null;
    let jumpTimeout: ReturnType<typeof setTimeout> | null = null;

    if (window.location.hash && document.querySelector(window.location.hash)) {
      // The browser already did its own native jump-to-fragment before this
      // effect ran, which Lenis knows nothing about — reset to a known
      // scroll position first so Lenis's target math isn't computed
      // relative to that untracked jump.
      if ("scrollRestoration" in history) history.scrollRestoration = "manual";
      window.scrollTo(0, 0);
      const hash = window.location.hash;
      const jump = () => {
        jumpTimeout = setTimeout(
          () => lenis.scrollTo(hash, { offset: NAV_OFFSET, immediate: true }),
          50,
        );
      };
      if (document.readyState === "complete") {
        jump();
      } else {
        loadListener = jump;
        window.addEventListener("load", loadListener, { once: true });
      }
    }

    const ctx = gsap.context(() => {
      const headline = document.querySelector('[data-anim="headline"]');
      if (headline) {
        const split = new SplitText(headline, { type: "words" });
        gsap.from(split.words, {
          yPercent: 100,
          opacity: 0,
          duration: 0.8,
          stagger: 0.04,
          ease: "power3.out",
        });
      }

      gsap.from('[data-anim="fade-up"]', {
        y: 24,
        opacity: 0,
        duration: 0.7,
        stagger: 0.1,
        delay: 0.3,
        ease: "power3.out",
      });

      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
        gsap.from(el, {
          y: 28,
          opacity: 0,
          duration: 0.6,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%" },
        });
      });

      document.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((el) => {
        const xTo = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3" });
        const yTo = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3" });

        const onMove = (e: MouseEvent) => {
          const rect = el.getBoundingClientRect();
          xTo((e.clientX - (rect.left + rect.width / 2)) * 0.25);
          yTo((e.clientY - (rect.top + rect.height / 2)) * 0.25);
        };
        const onLeave = () => {
          xTo(0);
          yTo(0);
        };

        el.addEventListener("mousemove", onMove);
        el.addEventListener("mouseleave", onLeave);
      });
    });

    return () => {
      document.removeEventListener("click", onAnchorClick);
      if (loadListener) window.removeEventListener("load", loadListener);
      if (jumpTimeout) clearTimeout(jumpTimeout);
      ctx.revert();
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, [reducedMotion]);

  return null;
}
