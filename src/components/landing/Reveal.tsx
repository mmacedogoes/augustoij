import { motion, useReducedMotion, type Variants } from "motion/react";
import type { ReactNode } from "react";

type Direction = "up" | "down" | "left" | "right" | "none";

const OFFSET = 28;

function offsetFor(dir: Direction) {
  switch (dir) {
    case "up":
      return { y: OFFSET };
    case "down":
      return { y: -OFFSET };
    case "left":
      return { x: OFFSET };
    case "right":
      return { x: -OFFSET };
    default:
      return {};
  }
}

/**
 * Fade + subtle translate on scroll-in. Runs once per element, respects
 * prefers-reduced-motion, and stays cheap (transform + opacity only).
 */
export function Reveal({
  children,
  direction = "up",
  delay = 0,
  className,
  amount = 0.2,
  as = "div",
}: {
  children: ReactNode;
  direction?: Direction;
  delay?: number;
  className?: string;
  amount?: number;
  as?: "div" | "section" | "article" | "li";
}) {
  const reduce = useReducedMotion();

  const variants: Variants = {
    hidden: { opacity: 0, ...offsetFor(reduce ? "none" : direction) },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: {
        duration: reduce ? 0 : 0.7,
        ease: [0.22, 1, 0.36, 1],
        delay: reduce ? 0 : delay,
      },
    },
  };

  const MotionTag = motion[as] as typeof motion.div;

  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount, margin: "0px 0px -10% 0px" }}
      variants={variants}
    >
      {children}
    </MotionTag>
  );
}

export default Reveal;