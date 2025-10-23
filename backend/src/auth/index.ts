import { jwt } from "@elysiajs/jwt";
import { Elysia, t } from "elysia";
import { createUser, getUserByUsername } from "./query";

export const AuthService = new Elysia({ name: 'Auth.Service' })
  .use(
    jwt({
      name: 'jwt',
      secret: Bun.env.JWT_SECRET || '',
      schema: t.Object({
        uuid: t.String()
      }),
      exp: '30d'
    })
  )
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
          uuid: payload.uuid
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
        uuid: t.String()
      })
    })
  )
  .post("/register", async ({ body: { username }, status }) => {
    const { Item } = await getUserByUsername(username);
    if (Item) {
      return status(409, { message: "Username already exists." });
    }

    await createUser(username);

    return { message: "User registered successfully. You can now login", username: username };
  }, {
    body: t.Object({
      username: t.String(),
    })
  })
  .post("/signin", async ({ jwt, body: { username }, status }) => {
    const { Item } = await getUserByUsername(username);

    if (!Item) {
      return status(404, { message: "User not found." });
    }

    const token = await jwt.sign({ uuid: Item.id?.S || "" });

    return { message: "User logged in successfully.", token };
  }, {
    body: t.Object({
      username: t.String(),
    }),
  })