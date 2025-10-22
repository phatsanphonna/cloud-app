import { Elysia } from "elysia";
import { AuthService } from "../auth";
import { UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { db } from "../database";

const AMOUNTS = [5, 10, 15, 20, 25, 30, 40, 50];

export const wallet = new Elysia({
  prefix: "/wallet",
})
  .use(AuthService)
  .post("/topup", async ({ uuid }) => {
    const got = AMOUNTS[Math.floor(Math.random() * AMOUNTS.length)];
    const command = new UpdateItemCommand({
      TableName: "Users",
      Key: {
        id: { S: uuid },
      },
      UpdateExpression: "SET money = money + :amount",
      ExpressionAttributeValues: {
        ":amount": { N: got!.toString() },
      },
      ReturnValues: "UPDATED_NEW",
    });

    const result = await db.send(command);

    return { message: "Top-up successful.", newBalance: result.Attributes?.money!.N, got };
  }, {
    isSignIn: true
  });
