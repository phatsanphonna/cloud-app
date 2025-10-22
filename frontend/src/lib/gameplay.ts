import { atom, useAtom } from "jotai";

const gameState = atom<"lobby" | "playing" | "paused" | "ended" | "none">("none");
export const useGameState = () => useAtom(gameState);