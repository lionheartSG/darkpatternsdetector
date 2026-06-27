"use client";

import { type MutableRefObject, useEffect, useRef, useState } from "react";

function animateProgressTo(
  target: number,
  currentRef: MutableRefObject<number>,
  setProgress: (value: number) => void,
  intervalRef: MutableRefObject<ReturnType<typeof setInterval> | null>,
) {
  const start = currentRef.current ?? 0;
  const delta = target - start;

  if (Math.abs(delta) < 0.5) {
    currentRef.current = target;
    setProgress(target);
    return;
  }

  const step = delta / 25;
  let ticks = 0;

  if (intervalRef.current) {
    clearInterval(intervalRef.current);
  }

  intervalRef.current = setInterval(() => {
    ticks += 1;
    currentRef.current = (currentRef.current ?? 0) + step;
    setProgress(Math.min(Math.max(currentRef.current, 0), 100));

    if (ticks >= 25) {
      currentRef.current = target;
      setProgress(target);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, 100);
}

export function useScanProgress(isActive: boolean) {
  const [progress, setProgress] = useState(0);
  const currentRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
      intervalRef.current = null;
      tickRef.current = null;
      currentRef.current = 0;
      setProgress(0);
      return;
    }

    animateProgressTo(5, currentRef, setProgress, intervalRef);

    tickRef.current = setInterval(() => {
      const ceiling = 92;
      if ((currentRef.current ?? 0) >= ceiling) return;
      const next = Math.min((currentRef.current ?? 0) + 1.5, ceiling);
      animateProgressTo(next, currentRef, setProgress, intervalRef);
    }, 2200);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [isActive]);

  return progress;
}
