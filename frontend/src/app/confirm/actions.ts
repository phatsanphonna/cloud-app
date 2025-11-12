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
      message: result.data.message || "Email confirmed!" 
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const { response } = error;
      return { 
        success: false, 
        message: response?.data?.message || "Verification failed, please try again" 
      };
    }

    return { 
      success: false, 
      message: "Verification failed, please try again" 
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
      message: result.data.message || "Verification code sent to your email!" 
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const { response } = error;
      return { 
        success: false, 
        message: response?.data?.message || "Unable to resend the code, please try again" 
      };
    }

    return { 
      success: false, 
      message: "Unable to resend the code, please try again" 
    };
  }
}
