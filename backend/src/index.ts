import { Elysia } from "elysia";
import { wallet } from "./route/wallet.js";
import { WSType } from "./model.js";

const users = new Set();

new Elysia()
  .use(wallet)
  .ws("/ws", {
    body: WSType,
    open(ws) {
      users.add(ws.id);
    },
    message(ws, { type, payload }) {
      // console.log("Received:", type, payload);
      ws.send({ type, payload });
      console.log(users)
    },
  })
  .get("/", () => "Hello Elysia")
  .listen(4000, ({ hostname, port }) => {
    console.log(`🦊 Elysia is running at ${hostname}:${port}`);
  });
