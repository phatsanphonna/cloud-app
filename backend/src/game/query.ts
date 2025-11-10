import { BatchGetItemCommand, GetItemCommand, QueryCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { db } from "../database";
import type { LobbyInfo, LobbyUser } from "./model";

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

export const addUserToGameRoom = async (gameId: string, userId: string) => {
  const command = new UpdateItemCommand({
    TableName: "Games",
    Key: {
      id: { S: gameId },
    },
    UpdateExpression: "SET players = list_append(if_not_exists(players, :emptyList), :newPlayer)",
    ExpressionAttributeValues: {
      ":emptyList": { L: [] },
      ":newPlayer": { L: [{ S: userId }] },
    },
    ReturnValues: "ALL_NEW",
  });
  return await db.send(command);
}

export const getLobbyInfo = async (gameId: string): Promise<LobbyInfo | null> => {
  // 1) Get the game
  const { Item } = await db.send(
    new GetItemCommand({
      TableName: "Games",
      Key: { id: { S: gameId } },
      // ProjectionExpression is optional; include if you want to trim attrs
      // ProjectionExpression: "id, title, type, roomCode, users",
    })
  );

  if (!Item) return null;

  // Convert the game item to a normal object
  const game = unmarshall(Item) as {
    id: string;
    title?: string;
    type?: string;
    roomCode?: string;
    users?: Set<string> | string[]; // SS becomes Set<string> after unmarshall
  };

  // 2) Collect user IDs
  const userIds = Array.isArray(game.users)
    ? game.users
    : Array.from(game.users ?? []);

  // if (userIds.length === 0) {
  //   return {
  //     id: game.id,
  //     title: game.title,
  //     type: game.type,
  //     roomCode: game.roomCode,
  //     users: [],
  //   };
  // }

  // 3) BatchGet users (max 100 keys per request)
  const chunks: string[][] = [];
  for (let i = 0; i < userIds.length; i += 100) {
    chunks.push(userIds.slice(i, i + 100));
  }

  const users: LobbyUser[] = [];
  for (const KeysIds of chunks) {
    const res = await db.send(
      new BatchGetItemCommand({
        RequestItems: {
          Users: {
            Keys: KeysIds.map((id) => ({ id: { S: id } })),
            ProjectionExpression: "id, username, profilePicture, money",
          },
        },
      })
    );
    const rows = res.Responses?.Users ?? [];
    for (const row of rows) {
      const u = unmarshall(row) as LobbyUser;
      // money may come back as number already; ensure number if needed
      if (u.money != null) u.money = Number(u.money);
      users.push(u);
    }
  }

  // 4) Return combined lobby info
  return {
    id: game.id,
    title: game.title || '',
    type: game.type || '',
    roomCode: game.roomCode || '',
    users,
  };
};