'use client'

import { Amplify } from 'aws-amplify';

// Only configure if we're in the browser and have the required env vars
if (typeof window !== 'undefined') {
  const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  
  if (userPoolId && clientId) {
    const amplifyConfig = {
      Auth: {
        Cognito: {
          userPoolId,
          userPoolClientId: clientId,
        },
      },
    };
    
    Amplify.configure(amplifyConfig);
  }
}

// Export a function to manually configure if needed
export const configureAmplify = () => {
  const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  
  if (userPoolId && clientId) {
    const amplifyConfig = {
      Auth: {
        Cognito: {
          userPoolId,
          userPoolClientId: clientId,
        },
      },
    };
    
    Amplify.configure(amplifyConfig);
    return true;
  }
  
  return false;
};