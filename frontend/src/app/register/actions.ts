'use client'

import axios from "axios"

export const register = async (username: string) => {
  try {
    const result = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
      username,
    });

    if (result.status !== 200) {
      throw new Error("Register failed");
    }

    return result.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const { response } = error;
      return { data: response?.data, status: response?.status };
    }

    return { data: null, status: 500 };
  }
}