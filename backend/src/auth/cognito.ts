import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  AuthFlowType,
} from "@aws-sdk/client-cognito-identity-provider";

// Use client-side only approach - no AWS credentials needed
const cognitoClient = new CognitoIdentityProviderClient({
  region: Bun.env.AWS_REGION || "us-east-1",
  // No credentials property - using anonymous access for client operations
});

export interface CognitoUser {
  username: string;
  email?: string;
  attributes?: Record<string, string>;
}

export class CognitoService {
  private userPoolId: string;
  private clientId: string;

  constructor() {
    this.userPoolId = Bun.env.COGNITO_USER_POOL_ID || "";
    this.clientId = Bun.env.COGNITO_CLIENT_ID || "";

    if (!this.userPoolId || !this.clientId) {
      console.warn("Cognito User Pool ID and Client ID not provided - Cognito features will be disabled");
    }
  }

  // Client-side user registration (no AWS credentials required)
  async createUser(username: string, email?: string, password?: string): Promise<any> {
    if (!this.isAvailable()) {
      throw new Error("Cognito not configured");
    }

    const command = new SignUpCommand({
      ClientId: this.clientId,
      Username: username,
      Password: password || "TempPassword123!", // Default password if not provided
      UserAttributes: [
        {
          Name: "email",
          Value: email || `${username}@example.com`,
        },
      ],
    });

    return cognitoClient.send(command);
  }

  // Confirm user registration (if email verification is required)
  async confirmSignUp(username: string, confirmationCode: string): Promise<any> {
    if (!this.isAvailable()) {
      throw new Error("Cognito not configured");
    }

    const command = new ConfirmSignUpCommand({
      ClientId: this.clientId,
      Username: username,
      ConfirmationCode: confirmationCode,
    });

    return cognitoClient.send(command);
  }

  // Resend confirmation code
  async resendConfirmationCode(username: string): Promise<any> {
    if (!this.isAvailable()) {
      throw new Error("Cognito not configured");
    }

    const command = new ResendConfirmationCodeCommand({
      ClientId: this.clientId,
      Username: username,
    });

    return cognitoClient.send(command);
  }

  // Client-side authentication (no AWS credentials required)
  async authenticateUser(username: string, password: string): Promise<any> {
    if (!this.isAvailable()) {
      throw new Error("Cognito not configured");
    }

    const command = new InitiateAuthCommand({
      ClientId: this.clientId,
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    });

    return cognitoClient.send(command);
  }

  // These methods are not available without admin credentials
  async setUserPassword(username: string, password: string, permanent = true): Promise<any> {
    throw new Error("Admin operations not available without AWS credentials. Use client-side password change instead.");
  }

  async getUser(username: string): Promise<any> {
    throw new Error("Admin operations not available without AWS credentials.");
  }

  async getUserByEmail(email: string): Promise<any> {
    throw new Error("Admin operations not available without AWS credentials.");
  }

  async updateUserAttributes(username: string, attributes: Record<string, string>): Promise<any> {
    throw new Error("Admin operations not available without AWS credentials.");
  }

  extractUserAttributes(cognitoUser: any): Record<string, string> {
    const attributes: Record<string, string> = {};
    
    if (cognitoUser.UserAttributes) {
      for (const attr of cognitoUser.UserAttributes) {
        attributes[attr.Name] = attr.Value;
      }
    }

    return attributes;
  }

  // Utility methods
  isAvailable(): boolean {
    return !!(this.userPoolId && this.clientId);
  }

  getUserPoolId(): string {
    return this.userPoolId;
  }

  getClientId(): string {
    return this.clientId;
  }
}

export const cognitoService = new CognitoService();