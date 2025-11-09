'use client'

import axios from "axios";

export const confirmSignUp = async (username: string, confirmationCode: string) => {
  try {
    const result = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/confirm`, {
      username,
      confirmationCode,
    });

    return { 
      success: true, 
      message: result.data.message || "Email confirmed successfully!" 
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const { response } = error;
      return { 
        success: false, 
        message: response?.data?.message || "Confirmation failed. Please try again." 
      };
    }

    return { 
      success: false, 
      message: "Confirmation failed. Please try again." 
    };
  }
}

export const resendConfirmationCode = async (username: string) => {
  try {
    const result = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/resend-code`, {
      username,
    });

    return { 
      success: true, 
      message: result.data.message || "Confirmation code sent to your email!" 
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const { response } = error;
      return { 
        success: false, 
        message: response?.data?.message || "Failed to resend code. Please try again." 
      };
    }

    return { 
      success: false, 
      message: "Failed to resend code. Please try again." 
    };
  }
}