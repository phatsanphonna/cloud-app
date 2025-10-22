"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import React, { ReactNode, useEffect, useMemo, useState } from "react";

/** A typed wheel item */
export type WheelItem<TId extends string | number = string> = {
  id: TId;                 // stable identifier (server returns this)
  label: string;           // text shown on the wedge
  color?: string;          // optional wedge color (fallback alternates)
  icon?: ReactNode;        // optional icon for the center when selected
};

type SpinWheelProps<TId extends string | number, TItem extends WheelItem<TId>> = {
  className?: string;
  items: readonly TItem[];
  /** Return the winning item id (sync or async). Must be one of items[].id */
  getResult: () => Promise<TId> | TId;
  /** Called with the full typed item after the animation ends */
  onFinished?: (item: TItem) => void;
  size?: number;       // px, default 300
  extraSpins?: number; // extra full rotations, default 5
};

export function SpinWheel<
  TId extends string | number,
  TItem extends WheelItem<TId>
>({
  className,
  items,
  getResult,
  onFinished,
  size = 300,
  extraSpins = 5,
}: SpinWheelProps<TId, TItem>) {
  const n = items.length;
  const SEGMENT_DEG = useMemo(() => (n > 0 ? 360 / n : 0), [n]);

  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [segmentWidth, setSegmentWidth] = useState(0);
  const [winner, setWinner] = useState<TItem | null>(null);

  // compute base width for the triangular wedge (keeps your clip-path approach)
  useEffect(() => {
    if (!SEGMENT_DEG) return;
    const radius = size / 2;
    const radians = SEGMENT_DEG * (Math.PI / 180);
    setSegmentWidth(2 * radius * Math.sin(radians / 2));
  }, [SEGMENT_DEG, size]);

  // spin so that slice i lands at the top (pointer)
  const spinToIndex = (i: number) => {
    const current = ((rotation % 360) + 360) % 360;
    const offsetToTop = SEGMENT_DEG / 2 - 6;
    const targetEffective = (360 - ((i * SEGMENT_DEG + offsetToTop) % 360)) % 360;
    const delta = extraSpins * 360 + ((targetEffective - current + 360) % 360);
    setRotation((r) => r + delta);
  };

  const handleSpin = async () => {
    if (isSpinning || n === 0) return;
    setIsSpinning(true);
    setWinner(null);

    // 1) get winning id from server (typed)
    const id = await Promise.resolve(getResult());

    // 2) find matching index
    const i = items.findIndex((it) => it.id === id);
    if (i < 0) {
      console.warn("[SpinWheel] getResult returned unknown id:", id);
      setIsSpinning(false);
      return;
    }

    // 3) spin & finish
    spinToIndex(i);
    setTimeout(() => {
      const w = items[i];
      setWinner(w);
      setIsSpinning(false);
      onFinished?.(w);
    }, 4000); // match motion duration
  };

  // fallback alternating colors
  const colorAt = (idx: number, selected: boolean): string => {
    if (selected) return "rgba(99,102,241,0.9)"; // highlight
    return items[idx]?.color ?? (idx % 2 === 0 ? "#7e57c2" : "#f06292");
  };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-6 p-4", className)}>
      <div className="relative rounded-full shadow-[0_0_30px_0_#673ab7]">
        {/* inside the wheel wrapper that has className="relative ..." */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 -top-4 -translate-x-1/2 z-50"
        >
          {/* main triangle pointing DOWN */}
          <div className="relative h-0 w-0
                  border-l-[18px] border-r-[18px] border-t-[26px]
                  border-l-transparent border-r-transparent border-t-amber-400 drop-shadow-lg" />
        </div>

        {/* spinning disc */}
        <motion.div
          className="relative flex items-center justify-center overflow-hidden rounded-full ring-8 ring-[#673ab7]"
          style={{ width: size, height: size }}
          animate={{ rotate: rotation }}
          transition={{ duration: 4, ease: "easeOut" }}
        >
          {items.map((it, index) => {
            const bg = colorAt(index, winner?.id === it.id);
            return (
              <div
                key={String(it.id)}
                className="absolute flex h-1/2 items-center justify-center drop-shadow-[inset_0_0_0_#bebebe, inset_0_10px_10px_#ffffff]"
                style={{
                  transform: `rotate(${index * SEGMENT_DEG}deg) translateY(50%)`,
                  clipPath: "polygon(50% 0%, -8% 100%, 100% 100%)",
                  width: `${segmentWidth}px`,
                  zIndex: n - index,
                  background: bg,
                }}
              >
                <span className="mt-5 rounded bg-black/90 px-2 py-0.5 text-xs font-bold text-white whitespace-nowrap">
                  {it.label}
                </span>
              </div>
            );
          })}
        </motion.div>

        {/* center dot / icon */}
        <div
          className="absolute left-1/2 top-1/2 z-[100] grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-neutral-900"
          style={{ width: size * 0.233, height: size * 0.233 }}
        >
          {winner?.icon}
        </div>
      </div>

      <Button onClick={handleSpin} disabled={isSpinning || n === 0}>
        {isSpinning ? "Spinning..." : "Spin the Wheel"}
      </Button>

      {winner && (
        <p className="text-lg font-semibold text-black">You won: {winner.label}!</p>
      )}
    </div>
  );
}
