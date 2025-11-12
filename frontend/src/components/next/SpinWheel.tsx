"use client";

import React, { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** A typed wheel item */
export type WheelItem<TId extends string | number = string> = {
  id: TId;          // stable id returned by your server
  label: string;    // text on the wedge
  color?: string;   // optional color (fallback alternates)
  icon?: ReactNode; // optional center icon when selected
};

type SpinWheelProps<TId extends string | number, TItem extends WheelItem<TId>> = {
  className?: string;
  items: readonly TItem[];
  /** Must return an id that exists in items[].id (sync or async) */
  getResult?: () => Promise<TId> | TId;
  /** Called with the full typed item after the animation ends */
  onFinished?: (item: TItem) => void;
  size?: number;         // wheel diameter (px)
  extraSpins?: number;   // extra full rotations
  durationSec?: number;  // animation duration (seconds)
  /** tiny angle tweak if your pointer/rim needs it; negative rotates a bit more */
  calibrationDeg?: number; // default -6
  /**
   * Optional external trigger. When provided with a new nonce, the wheel will
   * spin to the supplied id without invoking getResult().
   */
  trigger?: { id: TId; nonce: number } | null;
  /** Hide the built-in button and handle triggering externally */
  showButton?: boolean;
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
  durationSec = 4,
  calibrationDeg = -6,
  trigger = null,
  showButton = true,
}: SpinWheelProps<TId, TItem>) {
  const n = items.length;
  const SEGMENT_DEG = useMemo(() => (n > 0 ? 360 / n : 0), [n]);

  const [rotation, setRotation] = useState(0); // cumulative target angle
  const [isSpinning, setIsSpinning] = useState(false);
  const [segmentWidth, setSegmentWidth] = useState(0);
  const [winner, setWinner] = useState<TItem | null>(null);

  // remember which index should win when the animation completes
  const pendingIndexRef = useRef<number | null>(null);
  const lastTriggerNonce = useRef<number | null>(null);

  // compute wedge base width for the triangular clip-path
  useEffect(() => {
    if (!SEGMENT_DEG) return;
    const radius = size / 2;
    const radians = SEGMENT_DEG * (Math.PI / 180);
    setSegmentWidth(2 * radius * Math.sin(radians / 2));
  }, [SEGMENT_DEG, size]);

  useEffect(() => {
    if (!trigger) return;
    if (trigger.nonce === lastTriggerNonce.current) return;
    lastTriggerNonce.current = trigger.nonce;

    const idx = items.findIndex((it) => it.id === trigger.id);
    if (idx < 0) {
      console.warn("[SpinWheel] trigger id not found:", trigger.id);
      return;
    }
    if (n === 0) return;
    setIsSpinning(true);
    setWinner(null);
    pendingIndexRef.current = idx;
    spinToIndex(idx);
  }, [trigger, items, n]);

  // small tweak if your clipPath/pointer overlap needs it
  const CALIBRATION_DEG = -6; // try -5..-7 if a hair off

  // 0° = top, 90° = right, 180° = bottom, 270° = left
  // If you're landing opposite the pointer, set this to 180 first to confirm.
  const POINTER_ANGLE = 0; // change to 180 if your build is inverted

  const mod = (a: number, m: number) => ((a % m) + m) % m;

  // spin so slice i lands centered under the pointer angle
  const spinToIndex = (i: number) => {
    const current = mod(rotation, 360);
    const centerOffset = SEGMENT_DEG / 2 + CALIBRATION_DEG;

    // We want: i*SEGMENT_DEG + centerOffset + R ≡ POINTER_ANGLE (mod 360)
    const needed = mod(POINTER_ANGLE - (i * SEGMENT_DEG + centerOffset), 360);

    // always spin forward with extra full rotations
    const delta = extraSpins * 360 + mod(needed - current, 360);

    setRotation(r => r + delta);
  };

  const handleSpin = async () => {
    if (isSpinning || n === 0 || !getResult) return;
    setIsSpinning(true);
    setWinner(null);

    // play sound effect here if desired
    const audio = new Audio('/spin-wheel.mp3');
    audio.play().catch((err) => {
      console.warn("SpinWheel: failed to play sound:", err);
    });

    // ask server for winning id
    const id = await Promise.resolve(getResult());
    const idx = items.findIndex((it) => it.id === id);
    if (idx < 0) {
      console.warn("[SpinWheel] getResult returned id not in items:", id);
      setIsSpinning(false);
      return;
    }

    pendingIndexRef.current = idx;
    spinToIndex(idx);
  };

  // fallback alternating colors
  const colorAt = (idx: number, selected: boolean): string => {
    if (selected) return "rgba(99,102,241,0.9)"; // highlight
    return items[idx]?.color ?? (idx % 2 === 0 ? "#7e57c2" : "#f06292");
  };

  return (
      <div className={cn("flex flex-col items-center justify-center gap-6 p-4", className)}>
      <div className="relative rounded-full shadow-[0_0_30px_0_#673ab7]">
        {/* fixed pointer (straight triangle pointing DOWN, slight overlap) */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 z-50"
        >
          {/* optional outline matching rim */}
          <div className="absolute -top-[2px] left-1/2 -translate-x-1/2 h-0 w-0
                          border-l-[20px] border-r-[20px] border-t-[30px]
                          border-l-transparent border-r-transparent border-t-[#5b21b6]" />
          <div className="relative h-0 w-0
                          border-l-[18px] border-r-[18px] border-t-[26px]
                          border-l-transparent border-r-transparent border-t-amber-400 drop-shadow-lg" />
        </div>

        {/* spinning disc */}
        <motion.div
          className="relative flex items-center justify-center overflow-hidden rounded-full ring-8 ring-[#673ab7] rotate-180"
          style={{ width: size, height: size }}
          animate={{ rotate: rotation }}
          transition={{ duration: durationSec, ease: "easeOut" }}
          onAnimationComplete={() => {
            // finish exactly once when the spin completes
            const idx = pendingIndexRef.current;
            if (idx != null) {
              const w = items[idx];
              setWinner(w);
              setIsSpinning(false);
              pendingIndexRef.current = null;
              onFinished?.(w);
            }
            // NOTE: we do NOT "snap" rotation here—snapping causes the “second mini-spin”
          }}
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

      {showButton && (
        <Button onClick={handleSpin} disabled={isSpinning || n === 0}>
          {isSpinning ? "Spinning..." : "Spin the Wheel"}
        </Button>
      )}

      {winner && (
        <p className="text-lg font-semibold text-black">You won: {winner.label}!</p>
      )}
    </div>
  );
}

export default SpinWheel;
