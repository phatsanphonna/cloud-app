import { Elysia, t } from "elysia";
import { db } from "../database.js";
import { GetItemCommand } from "@aws-sdk/client-dynamodb";

export const game = new Elysia({
  prefix: "/games",
})
  .post("/join", async ({ body: { roomCode }, status }) => {
    const command = new GetItemCommand({
      TableName: "GameRooms",
      Key: {
        roomCode: { S: roomCode },
      },
    });

    const result = await db.send(command);

    if (!result.Item) {
      return status(404, { message: "Game room not found" });
    }

    return { message: "Code found." };
  }, {
    body: t.Object({
      roomCode: t.String()
    })
  },

  )