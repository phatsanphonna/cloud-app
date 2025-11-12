'use client'

import axios from "axios"

export const topup = async () => {
  const token = localStorage.getItem("token")

  if (!token) {
    throw new Error("Not signed in")
  }

  const result = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/wallet/topup`, {}, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (result.status !== 200) {
    throw new Error("Top up failed");
  }

  return result.data as { message: string; newBalance: number, got: number };
}
