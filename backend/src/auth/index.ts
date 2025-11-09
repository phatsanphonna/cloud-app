import { jwt } from "@elysiajs/jwt";
import { Elysia, t } from "elysia";
import { createUserWithCognito, authenticateUserWithCognito, getUserByUsername, getUserByCognitoSub } from "./query";
import { cognitoService } from "./cognito";

export const JwtService = new Elysia({ name: 'Auth.JWT.Service' })
  .use(
    jwt({
      name: 'jwt',
      secret: Bun.env.JWT_SECRET || '',
      schema: t.Object({
        uuid: t.String(),
        cognitoSub: t.String(),
      }),
      exp: '30d'
    })
  );

export const AuthService = new Elysia({ name: 'Auth.Service' })
  .use(JwtService)
  .guard({
    headers: t.Object({
      authorization: t.TemplateLiteral('Bearer ${string}')
    })
  })
  .macro({
    isSignIn: {
      async resolve({ headers: { authorization }, jwt, status }) {
        const token = authorization.split(" ")[1];

        if (!token) {
          return status(401, { message: "Unauthorized" });
        }

        const payload = await jwt.verify(token.replace("Bearer ", ""))

        if (!payload) {
          return status(401, { message: "Invalid token" });
        }

        return {
          uuid: payload.uuid,
          cognitoSub: payload.cognitoSub
        }
      }
    }
  });

export const auth = new Elysia({
  prefix: "/auth",
})
  .use(
    jwt({
      name: 'jwt',
      secret: Bun.env.JWT_SECRET || '',
      schema: t.Object({
        uuid: t.String(),
        cognitoSub: t.String(),
      })
    })
  )
  .post("/register", async ({ body: { username, password, email }, status }) => {
    try {
      // Check if user already exists in DynamoDB
      const { Item } = await getUserByUsername(username);
      if (Item) {
        return status(409, { message: "Username already exists." });
      }

      // Create user with Cognito and DynamoDB
      const result = await createUserWithCognito(username, password, email);

      return { 
        message: "User registered successfully. Please check your email for confirmation code.", 
        username: username,
        userId: result.userId,
        requiresConfirmation: result.requiresConfirmation || false
      };
    } catch (error: any) {
      console.error("Registration error:", error);
      
      // Handle specific Cognito errors
      if (error.name === "UsernameExistsException") {
        return status(409, { message: "Username already exists in Cognito." });
      }
      if (error.name === "InvalidPasswordException") {
        return status(400, { message: "Password does not meet requirements." });
      }
      
      return status(500, { message: "Registration failed. Please try again." });
    }
  }, {
    body: t.Object({
      username: t.String(),
      password: t.String(),
      email: t.Optional(t.String()),
    })
  })
  .post("/signin", async ({ jwt, body: { username, password }, status }) => {
    try {
      // Authenticate with Cognito
      const authResult = await authenticateUserWithCognito(username, password);

      if (!authResult.success || !authResult.user) {
        return status(404, { message: "User not found." });
      }

      // Create our own JWT token with user info
      const token = await jwt.sign({ 
        uuid: authResult.user.id?.S || "", 
        cognitoSub: authResult.cognitoSub 
      });

      return { 
        message: "User logged in successfully.", 
        token,
        user: {
          id: authResult.user.id?.S,
          username: authResult.user.username?.S,
          email: authResult.user.email?.S,
          money: parseInt(authResult.user.money?.N || "0"),
          profilePicture: authResult.user.profilePicture?.S,
        },
        // Optionally return Cognito tokens for advanced features
        cognitoTokens: {
          accessToken: authResult.tokens.accessToken,
          idToken: authResult.tokens.idToken,
        }
      };
    } catch (error: any) {
      console.error("Sign in error:", error);
      
      // Handle specific Cognito errors
      if (error.name === "NotAuthorizedException") {
        return status(401, { message: "Invalid username or password." });
      }
      if (error.name === "UserNotFoundException") {
        return status(404, { message: "User not found." });
      }
      
      return status(500, { message: "Sign in failed. Please try again." });
    }
  }, {
    body: t.Object({
      username: t.String(),
      password: t.String(),
    }),
  })
  .post("/confirm", async ({ body: { username, confirmationCode }, status }) => {
    try {
      // Confirm user registration with Cognito
      await cognitoService.confirmSignUp(username, confirmationCode);

      return { 
        message: "Email confirmed successfully. You can now sign in.", 
        username: username
      };
    } catch (error: any) {
      console.error("Confirmation error:", error);
      
      // Handle specific Cognito errors
      if (error.name === "CodeMismatchException") {
        return status(400, { message: "Invalid confirmation code." });
      }
      if (error.name === "ExpiredCodeException") {
        return status(400, { message: "Confirmation code has expired. Please request a new one." });
      }
      if (error.name === "UserNotFoundException") {
        return status(404, { message: "User not found." });
      }
      
      return status(500, { message: "Confirmation failed. Please try again." });
    }
  }, {
    body: t.Object({
      username: t.String(),
      confirmationCode: t.String(),
    }),
  })
  .post("/resend-code", async ({ body: { username }, status }) => {
    try {
      // Resend confirmation code
      await cognitoService.resendConfirmationCode(username);

      return { 
        message: "Confirmation code sent to your email.", 
        username: username
      };
    } catch (error: any) {
      console.error("Resend code error:", error);
      
      // Handle specific Cognito errors
      if (error.name === "UserNotFoundException") {
        return status(404, { message: "User not found." });
      }
      if (error.name === "InvalidParameterException") {
        return status(400, { message: "User is already confirmed." });
      }
      
      return status(500, { message: "Failed to resend confirmation code. Please try again." });
    }
  }, {
    body: t.Object({
      username: t.String(),
    }),
  })