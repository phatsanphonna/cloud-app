import { GetItemCommand, PutItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { db } from "../database";
import { v4 as uuidv4 } from "uuid";
import { generateProfilePicture } from "../user/profile-generator";
import { cognitoService } from "./cognito";

export const getUserByUUID = async (uuid: string) => {
  const command = new GetItemCommand({
    TableName: "Users",
    Key: {
      id: { S: uuid },
    },
  });
  return db.send(command);
}

export const getUserByCognitoSub = async (cognitoSub: string) => {
  const command = new QueryCommand({
    TableName: "Users",
    IndexName: "CognitoSubIndex", // GSI name for Cognito sub
    KeyConditionExpression: "cognitoSub = :sub",
    ExpressionAttributeValues: {
      ":sub": { S: cognitoSub },
    },
  });

  const result = await db.send(command);
  return { Item: result.Items?.[0] };
}

export const getUserByUsername = async (username: string) => {
  const command = new QueryCommand({
    TableName: "Users",
    IndexName: "UsernameIndex", // GSI name
    KeyConditionExpression: "username = :u",
    ExpressionAttributeValues: {
      ":u": { S: username },
    },
  });

  const result = await db.send(command);
  return { Item: result.Items?.[0] }; // usernames should be unique
}

export const createUser = async (username: string, email?: string, cognitoSub?: string) => {
  const userId = uuidv4();
  
  const command = new PutItemCommand({
    TableName: "Users",
    Item: {
      id: { S: userId },
      username: { S: username },
      email: { S: email || `${username}@example.com` },
      cognitoSub: { S: cognitoSub || "" },
      money: { N: "50" },
      profilePicture: { S: generateProfilePicture() },
      createdAt: { S: new Date().toISOString() },
    },
  });
  
  await db.send(command);
  return { userId };
}

export const createUserWithCognito = async (username: string, password: string, email?: string) => {
  try {
    // Create user in Cognito using client-side API
    const cognitoResult = await cognitoService.createUser(username, email, password);
    
    // Extract user info from Cognito response
    const cognitoSub = cognitoResult.UserSub;
    
    // Create user in DynamoDB with Cognito sub reference
    const result = await createUser(username, email, cognitoSub);
    
    return { success: true, userId: result.userId, cognitoSub, requiresConfirmation: !cognitoResult.UserConfirmed };
  } catch (error) {
    console.error("Error creating user with Cognito:", error);
    throw error;
  }
}

export const authenticateUserWithCognito = async (username: string, password: string) => {
  try {
    // Authenticate with Cognito using client-side API
    const authResult = await cognitoService.authenticateUser(username, password);
    
    if (!authResult.AuthenticationResult) {
      throw new Error("Authentication failed");
    }
    
    // Extract Cognito sub from ID token
    const idToken = authResult.AuthenticationResult.IdToken;
    let cognitoSub = null;
    
    if (idToken) {
      try {
        const tokenPayload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString());
        cognitoSub = tokenPayload.sub;
      } catch (tokenError) {
        console.warn("Could not parse ID token:", tokenError);
      }
    }
    
    // Get user from DynamoDB
    let userItem = null;
    
    if (cognitoSub) {
      // Try to find by Cognito sub first
      const { Item } = await getUserByCognitoSub(cognitoSub);
      userItem = Item;
    }
    
    if (!userItem) {
      // Fallback to username lookup
      const { Item } = await getUserByUsername(username);
      userItem = Item;
    }
    
    return {
      success: true,
      user: userItem,
      tokens: {
        accessToken: authResult.AuthenticationResult.AccessToken,
        idToken: authResult.AuthenticationResult.IdToken,
        refreshToken: authResult.AuthenticationResult.RefreshToken,
      },
      cognitoSub
    };
  } catch (error) {
    console.error("Error authenticating user with Cognito:", error);
    throw error;
  }
}