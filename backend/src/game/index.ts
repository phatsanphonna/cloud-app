import { Elysia, t } from "elysia";
import { db } from "../database.js";
import { GetItemCommand } from "@aws-sdk/client-dynamodb";
import { getGameByRoomCode } from "./query.js";

export const game = new Elysia({
  prefix: "/games",
})
  .post("/join", async ({ body: { roomCode }, status }) => {
    const { Item } = await getGameByRoomCode(roomCode);

    if (!Item) {
      return status(404, { message: "Game room not found" });
    }

    return { message: "Game room found.", gameId: Item.id!.S };
  }, {
    body: t.Object({
      roomCode: t.String()
    })
  });