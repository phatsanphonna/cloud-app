'use client'

import axios from "axios"

export const joinGame = async (roomCode: string) => {
  try {
    const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/games/join`, {
      roomCode,
    }, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
      }
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

export const joinRoom = async (roomCode: string) => {
  try {
    const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/room/join`, {
      roomCode,
    }, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
      }
    });

    if (response.status === 404) {
      throw new Error("Room not found");
    }

    return { data: response.data, status: response.status } as { data: { message: string; roomId: string; roomCode: string }, status: number };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const { response } = error;
      return { data: response?.data, status: response?.status };
    }

    return { data: null, status: 500 };
  }
}