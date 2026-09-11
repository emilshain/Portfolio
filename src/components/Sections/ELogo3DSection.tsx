"use client";

import dynamic from "next/dynamic";
import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLenis } from "lenis/react";

gsap.registerPlugin(ScrollTrigger);

const ELogo3D = dynamic(() => import("../UI/ELogo3D").then(mod => ({ default: mod.ELogo3D })), {
  ssr: false
});

const achievements = [
  { title: "Hackathena 2026", result: "1st Place Winner", tags: ["1st Place", "National"] },
  { title: "Astrava 2026", result: "National Runner Up", tags: ["2nd Runner Up", "National"] },
  { title: "BeachHack 7", result: "2nd Place", tags: ["2nd Place", "HACK4CHRIST"] },
  { title: "Fontober 2025", result: "Top 100 National", tags: ["Top 100", "Designare"] },
];

export const ELogo3DSection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [scrollDistance, setScrollDistance] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);
  const lenis = useLenis();

  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const section = sectionRef.current;
    const wrapper = wrapperRef.current;
    const container = containerRef.current;
    const lines = lineRefs.current.filter(Boolean) as HTMLSpanElement[];
    if (!section || !wrapper || !container || lines.length === 0) return;

    const getLineMaxScroll = (line: HTMLSpanElement) => Math.max(0, line.scrollWidth - window.innerWidth);
    const getOverallMaxScroll = () => Math.max(...lines.map(getLineMaxScroll));
    const getHoldDistance = () => Math.max(getOverallMaxScroll(), window.innerHeight);

    // After the pin releases, make ONLY this section's content lag behind the
    // page scroll with a scrubbed transform, so it visually scrolls away slower
    // while the rest of the page (incl. Selected Works) keeps normal speed.
    // This decouples the two sections — no global scroll multiplier involved.
    const EXIT_SLOW_FACTOR = 0.45; // 1 = normal speed, 0 = frozen
    const getExitDistance = () => Math.round(window.innerHeight * 0.8);

    setScrollDistance(getHoldDistance());

    const tl = gsap.timeline({
      scrollTrigger: {
        id: "elogo3d-scrub",
        // Anchor to the static wrapper, not the sticky <section>: a sticky
        // element's measured position changes with the current scroll, so any
        // ScrollTrigger refresh while pinned re-anchors start/end to the live
        // scroll position and restarts the scrub as the section scrolls away.
        trigger: wrapper,
        start: "top top",
        end: () => "+=" + getOverallMaxScroll(),
        scrub: true,
        invalidateOnRefresh: true
      }
    });

    lines.forEach((line) => {
      // Function-based so refresh (fonts, resize) re-derives each target
      tl.to(line, { x: () => -getLineMaxScroll(line), ease: "none" }, 0);
    });

    // Re-measure once webfonts are in so scroll distances use final glyph widths
    let disposed = false;
    document.fonts?.ready.then(() => {
      if (!disposed) ScrollTrigger.refresh();
    }).catch(() => {});

    const handleResize = () => {
      setScrollDistance(getHoldDistance());
      ScrollTrigger.refresh();
    };
    window.addEventListener("resize", handleResize);

    // ScrollTrigger anchored to the section's scroll-away range: starts at the
    // actual pin release (end of the wrapper's hold distance, which is >= the
    // horizontal scrub) and runs over the exit distance. The downward lag
    // cancels part of the upward movement, so the section's visual exit is
    // slower than the page scroll around it — never during the pin.
    const exitTl = gsap.timeline({
      scrollTrigger: {
        id: "elogo3d-exit-lag",
        trigger: wrapper,
        start: () => `top+=${getHoldDistance()} top`,
        end: () => `top+=${getHoldDistance() + getExitDistance()} top`,
        scrub: 0.5, // slight smoothing for a natural catch-up feel
        invalidateOnRefresh: true,
      },
    });
    exitTl.fromTo(
      section,
      { y: 0 },
      { y: () => getExitDistance() * (1 - EXIT_SLOW_FACTOR), ease: "none", immediateRender: false }
    );

    let handleMouseMove: ((e: MouseEvent) => void) | null = null;
    if (isDesktop) {
      handleMouseMove = (e: MouseEvent) => {
        const rect = section.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        section.dispatchEvent(
          new CustomEvent("mousemove3d", {
            detail: { x, y, clientX: e.clientX, clientY: e.clientY },
          })
        );
      };
      section.addEventListener("mousemove", handleMouseMove);
    }

    return () => {
      disposed = true;
      exitTl.scrollTrigger?.kill();
      exitTl.kill();
      gsap.set(section, { clearProps: "transform" });
      window.removeEventListener("resize", handleResize);
      if (handleMouseMove) {
        section.removeEventListener("mousemove", handleMouseMove);
      }
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, [isDesktop, lenis]);

  return (
    <div ref={wrapperRef} className="relative w-full" style={{ height: `calc(100vh + ${scrollDistance}px)` }}>
      <section
        ref={sectionRef}
        className="sticky top-0 w-full h-screen bg-black overflow-hidden"
      >
        {/* Pinned horizontal scroll lines */}
        <div ref={containerRef} className="h-full flex flex-col justify-center">
          {achievements.map((a, i) => (
            <span
              key={i}
              ref={(el) => { lineRefs.current[i] = el; }}
              className="text-[10vw] sm:text-[12vw] md:text-[14vw] tracking-tighter text-white leading-[0.9] uppercase whitespace-nowrap"
              style={{ willChange: "transform" }}
            >
              {a.title}
              {a.tags && a.tags.length > 0 ? ` • ${a.tags.join(" • ")}` : ""}
            </span>
          ))}
        </div>

        {/* 3D Model in foreground - Desktop only */}
        {isDesktop && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" style={{ perspective: "1000px" }}>
            <div className="w-[80vw] h-[80vh] sm:w-[100vw] sm:h-[100vh] md:w-[120vw] md:h-[120vh] flex items-center justify-center pointer-events-auto">
              <ELogo3D />
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
