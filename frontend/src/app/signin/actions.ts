'use client'

import axios from "axios";
import { cognitoAuth } from "../../lib/auth/cognito";

export const signIn = async (username: string, password?: string) => {
  try {
    // If password is provided, use our backend with Cognito authentication
    if (password) {
      const result = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/signin`, {
        username,
        password,
      });

      if (result.status === 200) {
        const token = result.data.token;
        localStorage.setItem("token", token);
        
        // Store user data in localStorage
        if (result.data.user) {
          localStorage.setItem("user", JSON.stringify(result.data.user));
        }
        
        window.location.reload();
        return { data: result.data, status: result.status };
      }

      return { data: result.data, status: result.status };
    } else {
      // Legacy username-only signin (for backward compatibility)
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
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const { response } = error;
      return { data: response?.data, status: response?.status };
    }

    return { data: null, status: 500 };
  }
}

export const signInWithCognito = async (username: string, password: string) => {
  try {
    // First authenticate with Cognito directly
    const cognitoResult = await cognitoAuth.signIn(username, password);
    
    if (!cognitoResult.success) {
      // Check if it's a confirmation error
      if (cognitoResult.message?.includes("not confirmed") || cognitoResult.message?.includes("UserNotConfirmedException")) {
        return { 
          data: { 
            message: "Email not confirmed. Please check your email for confirmation code.",
            requiresConfirmation: true,
            username 
          }, 
          status: 403 
        };
      }
      
      return { data: { message: cognitoResult.message }, status: 401 };
    }

    // Then get our backend token
    const result = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/signin`, {
      username,
      password,
    });

    if (result.status === 200) {
      const token = result.data.token;
      localStorage.setItem("token", token);
      
      // Store user data and Cognito tokens
      if (result.data.user) {
        localStorage.setItem("user", JSON.stringify(result.data.user));
      }
      
      if (result.data.cognitoTokens) {
        localStorage.setItem("cognitoTokens", JSON.stringify(result.data.cognitoTokens));
      }
      
      window.location.reload();
    }

    return { data: result.data, status: result.status };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const { response } = error;
      
      // Handle specific backend confirmation errors
      if (response?.status === 403 && response?.data?.requiresConfirmation) {
        return { 
          data: { 
            message: "Email not confirmed. Please check your email for confirmation code.",
            requiresConfirmation: true,
            username 
          }, 
          status: 403 
        };
      }
      
      return { data: response?.data, status: response?.status };
    }

    return { data: null, status: 500 };
  }
}

export const signOut = async () => {
  try {
    // Sign out from Cognito
    await cognitoAuth.signOut();
    
    // Clear local storage
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("cognitoTokens");
    
    window.location.reload();
    
    return { success: true };
  } catch (error) {
    console.error("Sign out error:", error);
    return { success: false, error };
  }
}