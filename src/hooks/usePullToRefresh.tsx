import { useEffect, useRef, useState } from "react";

/**
 * Pull-to-refresh hook for mobile scrollable containers.
 * Attach the returned ref to the scrollable element.
 */
export function usePullToRefresh(onRefresh: () => Promise<void> | void, threshold = 80) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pullDist, setPullDist] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      if (el.scrollTop > 0) { startY.current = null; return; }
      startY.current = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current == null || refreshing) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0 && el.scrollTop === 0) {
        setPullDist(Math.min(dy, threshold * 1.5));
      }
    };
    const onEnd = async () => {
      if (startY.current == null) return;
      const dist = pullDist;
      startY.current = null;
      if (dist >= threshold && !refreshing) {
        setRefreshing(true);
        try { await onRefresh(); } finally {
          setRefreshing(false);
          setPullDist(0);
        }
      } else {
        setPullDist(0);
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
  }, [onRefresh, pullDist, refreshing, threshold]);

  return { ref, pullDist, refreshing, threshold };
}

export function PullIndicator({ pullDist, refreshing, threshold, color = "#1F4E79" }: { pullDist: number; refreshing: boolean; threshold: number; color?: string }) {
  const visible = pullDist > 8 || refreshing;
  if (!visible) return null;
  const progress = Math.min(pullDist / threshold, 1);
  return (
    <div className="flex justify-center items-center transition-all" style={{ height: refreshing ? 40 : Math.min(pullDist, 60) }}>
      <div
        className={refreshing ? "animate-spin" : ""}
        style={{
          width: 22, height: 22,
          border: `2.5px solid ${color}`,
          borderTopColor: "transparent",
          borderRadius: "50%",
          opacity: refreshing ? 1 : 0.4 + progress * 0.6,
          transform: refreshing ? "none" : `rotate(${progress * 360}deg)`,
        }}
      />
    </div>
  );
}
