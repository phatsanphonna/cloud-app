import { 
  signIn as amplifySignIn, 
  signUp as amplifySignUp, 
  signOut as amplifySignOut, 
  getCurrentUser,
  fetchAuthSession
} from 'aws-amplify/auth';
import { configureAmplify } from '../amplify-config';

export interface CognitoAuthResult {
  success: boolean;
  message?: string;
  user?: any;
  nextStep?: any;
}

// Ensure Amplify is configured before use
const ensureAmplifyConfigured = () => {
  if (!configureAmplify()) {
    console.warn('Cognito configuration not available - check environment variables');
    return false;
  }
  return true;
};

export const cognitoAuth = {
  async signUp(username: string, password: string, email?: string): Promise<CognitoAuthResult> {
    if (!ensureAmplifyConfigured()) {
      return { success: false, message: 'Cognito not configured' };
    }

    try {
      const { userId, nextStep } = await amplifySignUp({
        username,
        password,
        options: {
          userAttributes: {
            email: email || `${username}@example.com`,
          },
        },
      });

      return {
        success: true,
        message: 'User created successfully',
        user: { userId },
        nextStep,
      };
    } catch (error: any) {
      console.error('Cognito sign up error:', error);
      return {
        success: false,
        message: error.message || 'Sign up failed',
      };
    }
  },

  async signIn(username: string, password: string): Promise<CognitoAuthResult> {
    if (!ensureAmplifyConfigured()) {
      return { success: false, message: 'Cognito not configured' };
    }

    try {
      const { isSignedIn, nextStep } = await amplifySignIn({
        username,
        password,
      });

      if (isSignedIn) {
        const user = await getCurrentUser();
        return {
          success: true,
          message: 'Sign in successful',
          user,
        };
      }

      return {
        success: false,
        message: 'Sign in incomplete',
        nextStep,
      };
    } catch (error: any) {
      console.error('Cognito sign in error:', error);
      return {
        success: false,
        message: error.message || 'Sign in failed',
      };
    }
  },

  async signOut(): Promise<CognitoAuthResult> {
    if (!ensureAmplifyConfigured()) {
      return { success: false, message: 'Cognito not configured' };
    }

    try {
      await amplifySignOut();
      return {
        success: true,
        message: 'Signed out successfully',
      };
    } catch (error: any) {
      console.error('Cognito sign out error:', error);
      return {
        success: false,
        message: error.message || 'Sign out failed',
      };
    }
  },

  async getCurrentUser(): Promise<any> {
    if (!ensureAmplifyConfigured()) {
      return null;
    }

    try {
      const user = await getCurrentUser();
      return user;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  },

  async getAccessToken(): Promise<string | null> {
    if (!ensureAmplifyConfigured()) {
      return null;
    }

    try {
      const session = await fetchAuthSession();
      return session.tokens?.accessToken?.toString() || null;
    } catch (error) {
      console.error('Get access token error:', error);
      return null;
    }
  },
};