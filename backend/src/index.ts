import { GetItemCommand } from "@aws-sdk/client-dynamodb";
import { cors } from "@elysiajs/cors";
import { openapi } from '@elysiajs/openapi';
import { Elysia } from "elysia";
import { auth } from "./auth/index.js";
import { db } from "./database.js";
import { WSParamsType, WSType } from "./model.js";
import { user } from "./user/index.js";
import { wallet } from "./wallet/index.js";
import { game } from "./game/index.js";
import { getGameRoomById } from "./game/query.js";

const users = new Set();

new Elysia()
  .use(cors())
  .use(openapi())
  .use(auth)
  .use(user)
  .use(wallet)
  .use(game)
  .ws("/ws/games/:id", {
    body: WSType,
    params: WSParamsType,
    async open({ data, send, close }) {
      try {
        const id = data.params.id;          // <- get route param safely
        const { Item } = await getGameRoomById(id);

        if (!Item) {
          // either just close:
          // ws.close(1000, "Game room not found");
          // or send an error then close:
          send({ type: "error", payload: { message: "Game room not found" } });
          close(1000, "Game room not found");
          return;
        }

        send({ type: "lobby", payload: { message: `Connected to game room ${id}` } });
      } catch (err) {
        console.error(err);
        send({ type: "error", payload: { message: "Internal error" } });
        close(1011, "Internal error");
      }
    },
    async message({ send }, { type, payload }) {
      send({ type, payload });
      console.log(users);
    },
  })
  .get("/", () => "Hello Elysia")
  .listen(4000, ({ hostname, port }) => {
    console.log(`🦊 Elysia is running at ${hostname}:${port}`);
  });
