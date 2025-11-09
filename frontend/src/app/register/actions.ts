'use client'

import axios from "axios"
import { cognitoAuth } from "../../lib/auth/cognito";

export const register = async (username: string, password: string, email?: string) => {
  try {
    // Register with our backend (which will create Cognito user and DynamoDB record)
    const result = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
      username,
      password,
      email,
    });

    console.log("Backend registration result:", result); // Debug log

    return { 
      message: result.data.message,
      requiresConfirmation: result.data.requiresConfirmation || false,
      status: result.status
    };
  } catch (error) {
    console.error("Registration error:", error); // Debug log
    
    if (axios.isAxiosError(error)) {
      const { response } = error;
      return { 
        message: response?.data?.message || "Registration failed",
        status: response?.status || 500
      };
    }

    return { 
      message: "Registration failed",
      status: 500 
    };
  }
}

export const registerWithCognito = async (username: string, password: string, email?: string) => {
  try {
    // Register directly with Cognito first (optional - for pure client-side approach)
    const cognitoResult = await cognitoAuth.signUp(username, password, email);
    
    if (!cognitoResult.success) {
      return { data: { message: cognitoResult.message }, status: 400 };
    }

    // Then register with our backend
    const result = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
      username,
      password,
      email,
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