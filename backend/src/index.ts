import { GetItemCommand } from "@aws-sdk/client-dynamodb";
import { cors } from "@elysiajs/cors";
import { openapi } from '@elysiajs/openapi';
import { Elysia } from "elysia";
import { auth } from "./auth/index.js";
import { db } from "./database.js";
import { WSParamsType, WSType } from "./model.js";
import { user } from "./user/index.js";
import { wallet } from "./wallet/index.js";

const users = new Set();

new Elysia()
  .use(cors())
  .use(openapi())
  .use(auth)
  .use(user)
  .use(wallet)
  .ws("/ws/games/:id", {
    body: WSType,
    params: WSParamsType,
    async open(ws) {
      const id = ws.data.params.id;

      const command = new GetItemCommand({
        TableName: "GameRooms",
        Key: {
          id: { S: id },
        },
      });

      const result = await db.send(command);

      if (!result.Item) {
        ws.close(1000, "Game room not found");
        return ws.send({ type: "error", payload: { message: "Game room not found" } });
      }
    },
    async message(ws, { type, payload }) {
      ws.send({ type, payload });
      console.log(users);
    },
  })
  .get("/", () => "Hello Elysia")
  .listen(4000, ({ hostname, port }) => {
    console.log(`🦊 Elysia is running at ${hostname}:${port}`);
  });
