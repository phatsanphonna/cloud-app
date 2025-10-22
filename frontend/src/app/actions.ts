'use client'

import axios from "axios"

export const joinGame = async (roomCode: string) => {
  const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/games/join`, {
    roomCode,
  });

  if (response.status === 404) {
    throw new Error("Game room not found");
  }

  return response.data;
}