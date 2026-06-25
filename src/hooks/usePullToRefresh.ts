import { useEffect, useRef, useState } from "react";

/**
 * Lightweight pull-to-refresh hook for mobile tabs.
 * Attach `bind` to a scrollable element; calls `onRefresh` when user pulls past threshold.
 */
export function usePullToRefresh(onRefresh: () => void | Promise<void>, threshold = 70) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pulling, setPulling] = useState(0);
  const startY = useRef<number | null>(null);
  const refreshing = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      if (el.scrollTop > 0 || refreshing.current) return;
      startY.current = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0) setPulling(Math.min(dy, threshold * 1.5));
    };
    const onEnd = async () => {
      if (startY.current == null) return;
      const dy = pulling;
      startY.current = null;
      if (dy >= threshold && !refreshing.current) {
        refreshing.current = true;
        try { await onRefresh(); } finally {
          refreshing.current = false;
          setPulling(0);
        }
      } else {
        setPulling(0);
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, [onRefresh, threshold, pulling]);

  return { ref, pulling, threshold };
}
