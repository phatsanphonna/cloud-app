'use client'

import axios from "axios"

export const joinGame = async (roomCode: string) => {
  try {
    const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/games/join`, {
      roomCode,
    });

    if (response.status === 404) {
      throw new Error("Game room not found");
    }

    return { data: response.data, status: response.status } as { data: { message: string; gameId: string }, status: number };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const { response } = error;
      return { data: response?.data, status: response?.status };
    }

    return { data: null, status: 500 };
  }
}