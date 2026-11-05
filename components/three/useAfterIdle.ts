"use client";

import { useEffect, useState } from "react";

/** True once the page has loaded and the browser is idle. Gate every 3D
 *  scene on it, so three.js is neither downloaded nor started before the
 *  first paint. (No three.js import here: this file ships with the page.) */
export function useAfterIdle(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let handle: number | undefined;
    const go = () => setReady(true);
    const schedule = () => {
      handle = typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(go, { timeout: 2500 })
        : window.setTimeout(go, 600);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      window.removeEventListener("load", schedule);
      if (handle === undefined) return;
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);
  return ready;
}
