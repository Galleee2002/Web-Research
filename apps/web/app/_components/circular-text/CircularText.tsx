"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";

import "./CircularText.scss";

export type CircularTextHover = "slowDown" | "speedUp" | "pause" | "goBonkers";

type CircularTextProps = {
  text: string;
  spinDuration?: number;
  onHover?: CircularTextHover;
  className?: string;
};

export default function CircularText({
  text,
  spinDuration = 20,
  onHover,
  className = "",
}: CircularTextProps) {
  const letters = Array.from(text);
  const [duration, setDuration] = useState(spinDuration);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    setDuration(spinDuration);
  }, [spinDuration]);

  const handleHoverStart = () => {
    if (!onHover) {
      return;
    }

    switch (onHover) {
      case "slowDown":
        setDuration(spinDuration * 2);
        setScale(1);
        break;
      case "speedUp":
        setDuration(Math.max(0.12, spinDuration / 4));
        setScale(1);
        break;
      case "pause":
        setDuration(1e9);
        setScale(1);
        break;
      case "goBonkers":
        setDuration(Math.max(0.06, spinDuration / 20));
        setScale(0.8);
        break;
      default:
        setDuration(spinDuration);
        setScale(1);
    }
  };

  const handleHoverEnd = () => {
    setDuration(spinDuration);
    setScale(1);
  };

  return (
    <motion.div
      className={`circular-text ${className}`.trim()}
      animate={{ rotate: 360, scale }}
      transition={{
        rotate: {
          duration,
          ease: "linear",
          repeat: Infinity,
          repeatType: "loop",
        },
        scale: { type: "spring", damping: 20, stiffness: 300 },
      }}
      onMouseEnter={onHover ? handleHoverStart : undefined}
      onMouseLeave={onHover ? handleHoverEnd : undefined}
    >
      {letters.map((letter, i) => {
        const rotationDeg = (360 / letters.length) * i;
        const factor = Math.PI / letters.length;
        const x = factor * i;
        const y = factor * i;
        const transform = `rotateZ(${rotationDeg}deg) translate3d(${x}px, ${y}px, 0)`;

        return (
          <span key={`${i}-${letter}`} style={{ transform, WebkitTransform: transform }}>
            {letter}
          </span>
        );
      })}
    </motion.div>
  );
}
