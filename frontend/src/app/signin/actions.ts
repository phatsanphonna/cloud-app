'use client'

import axios from "axios"

export const signIn = async (username: string) => {
  try {
    const result = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/signin`, {
      username,
    });

    if (result.status === 404) {
      return { data: result.data, status: result.status };
    }

    const token = result.data.token;
    localStorage.setItem("token", token);
    window.location.reload();

    return { data: result.data, status: result.status };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const { response } = error;
      return { data: response?.data, status: response?.status };
    }

    return { data: null, status: 500 };
  }
}