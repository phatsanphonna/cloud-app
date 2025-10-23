import { GetItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { db } from "../database";

export const getGameByRoomCode = async (roomCode: string) => {
  const command = new QueryCommand({
    TableName: "Games",
    IndexName: "RoomCodeIndex", // GSI name
    KeyConditionExpression: "roomCode = :r",
    ExpressionAttributeValues: {
      ":r": { S: roomCode },
    },
  });

  const result = await db.send(command);
  return { Item: result.Items?.[0] }; // roomCodes should be unique
}

export const getGameRoomById = async (id: string) => {
  const command = new GetItemCommand({
    TableName: "Games",
    Key: {
      id: { S: id },
    },
  });

  return await db.send(command);
}