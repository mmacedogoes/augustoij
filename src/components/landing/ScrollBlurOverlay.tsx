import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * Fixed frosted band at the bottom of the viewport. Reveals as the user
 * scrolls the page and fades out again when they approach the footer,
 * so it never covers the manifesto/CTA.
 */
export function ScrollBlurOverlay() {
  const reduce = useReducedMotion();
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (reduce) return;
    let raf = 0;

    const compute = () => {
      const y = window.scrollY;
      const vh = window.innerHeight;
      const docH = document.documentElement.scrollHeight;
      const maxScroll = Math.max(docH - vh, 1);

      // Fade in over the first viewport of scroll, fade back out over
      // the final ~85vh so the footer breathes.
      const fadeIn = Math.min(y / (vh * 0.6), 1);
      const distanceToBottom = maxScroll - y;
      const fadeOut = Math.min(distanceToBottom / (vh * 0.85), 1);

      const next = Math.max(0, Math.min(1, fadeIn * fadeOut));
      setOpacity((prev) => (Math.abs(prev - next) > 0.01 ? next : prev));
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        compute();
      });
    };

    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", compute);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduce]);

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 h-40 md:h-52"
      style={{ opacity }}
      transition={{ duration: 0.2, ease: "linear" }}
    >
      {/* Progressive blur: stacked bands with increasing blur toward the bottom.
          Each band is masked so the transition between them is a soft gradient
          instead of a hard edge. */}
      <div
        className="absolute inset-0 supports-[backdrop-filter]:backdrop-blur-[2px]"
        style={{
          WebkitMaskImage:
            "linear-gradient(to top, black 0%, black 55%, transparent 100%)",
          maskImage:
            "linear-gradient(to top, black 0%, black 55%, transparent 100%)",
        }}
      />
      <div
        className="absolute inset-0 supports-[backdrop-filter]:backdrop-blur-md"
        style={{
          WebkitMaskImage:
            "linear-gradient(to top, black 0%, black 35%, transparent 85%)",
          maskImage:
            "linear-gradient(to top, black 0%, black 35%, transparent 85%)",
        }}
      />
      <div
        className="absolute inset-0 supports-[backdrop-filter]:backdrop-blur-xl"
        style={{
          WebkitMaskImage:
            "linear-gradient(to top, black 0%, black 15%, transparent 65%)",
          maskImage:
            "linear-gradient(to top, black 0%, black 15%, transparent 65%)",
        }}
      />
      {/* Warm cream tint so the blur feels like part of the brand, not a haze */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, color-mix(in oklab, var(--augusto-cream) 55%, transparent) 0%, transparent 80%)",
        }}
      />
    </motion.div>
  );
}

export default ScrollBlurOverlay;