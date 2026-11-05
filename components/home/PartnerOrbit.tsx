"use client";

import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "motion/react";

// three.js only loads in the browser, after the page, so it never slows the
// first paint.
const PartnerCoin3D = dynamic(() => import("./PartnerCoin3D"), { ssr: false });

// Centre of the partners row: the 3D Flush/Qzino coin inside a chrome ring.
export function PartnerOrbit({ className = "" }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={`orbit ${className}`}
      aria-hidden
      initial={reduce ? false : { opacity: 0, scale: 0.7, rotate: -20 }}
      whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ type: "spring", stiffness: 120, damping: 14 }}
    >
      <div className="orbit-ring orbit-ring-outer" />
      <div className="orbit-ring orbit-ring-inner" />
      <div className="absolute inset-[-12%]">
        <PartnerCoin3D />
      </div>
    </motion.div>
  );
}
