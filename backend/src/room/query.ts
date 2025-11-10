import {
  AttributeValue,
  BatchGetItemCommand,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  ScanCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { db } from "../database";
import { ulid } from "ulid";

export const createRoom = async (hostId: string, minPlayer: number) => {
  const roomId = ulid();
  const roomCode = generateRoomCode(); // Generate a short room code
  const room = {
    id: roomId,
    roomCode,
    hostId,
    minPlayer,
    players: [hostId], // Array instead of Set
    status: "waiting",
    createdAt: new Date().toISOString(),
  };

  console.log("Creating room with data:", room);

  const command = new PutItemCommand({
    TableName: "Rooms",
    Item: marshall(room),
  });

  console.log("Marshalled item:", marshall(room));

  await db.send(command);
  return room;
};

// Helper function to generate a short room code
const generateRoomCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  console.log("Generated room code:", result);
  return result;
};

export const getRoom = async (roomId: string) => {
  const command = new GetItemCommand({
    TableName: "Rooms",
    Key: {
      id: { S: roomId },
    },
  });

  const result = await db.send(command);
  if (!result.Item) {
    return null;
  }
  // Convert DynamoDB format to regular JavaScript object
  return unmarshall(result.Item);
};

export const getRoomByCode = async (roomCode: string) => {
  // Try GSI first
  try {
    const command = new QueryCommand({
      TableName: "Rooms",
      IndexName: "RoomCodeIndex", // GSI name
      KeyConditionExpression: "roomCode = :code",
      ExpressionAttributeValues: {
        ":code": { S: roomCode },
      },
    });

    const result = await db.send(command);
    const item = result.Items?.[0]; // room codes should be unique
    if (item) {
      return unmarshall(item);
    }
  } catch (error) {
    console.log("GSI not available, falling back to scan");
  }

  // Fallback to scan if GSI doesn't exist
  const scanCommand = new ScanCommand({
    TableName: "Rooms",
    FilterExpression: "roomCode = :code",
    ExpressionAttributeValues: {
      ":code": { S: roomCode },
    },
  });

  const result = await db.send(scanCommand);
  const item = result.Items?.[0]; // room codes should be unique
  if (!item) {
    return null;
  }
  return unmarshall(item);
};

export const joinRoom = async (roomId: string, userId: string) => {
  // First get the current room
  const room = await getRoom(roomId);
  if (!room) {
    throw new Error("Room not found");
  }

  // Check if user is already in the room
  const currentPlayers: string[] = room.players || [];
  if (currentPlayers.includes(userId)) {
    return room;
  }

  // Add user to players array
  const updatedPlayers = [...currentPlayers, userId];

  const command = new UpdateItemCommand({
    TableName: "Rooms",
    Key: {
      id: { S: roomId },
    },
    UpdateExpression: "SET players = :players",
    ExpressionAttributeValues: {
      ":players": { L: updatedPlayers.map((id: string) => ({ S: id })) },
    },
    ReturnValues: "ALL_NEW",
  });
  return await db.send(command);
};

export const leaveRoom = async (roomId: string, userId: string) => {
  // First get the current room
  const room = await getRoom(roomId);
  if (!room) {
    throw new Error("Room not found");
  }

  // Remove user from players array
  const currentPlayers: string[] = room.players || [];
  const updatedPlayers = currentPlayers.filter((id: string) => id !== userId);

  const command = new UpdateItemCommand({
    TableName: "Rooms",
    Key: {
      id: { S: roomId },
    },
    UpdateExpression: "SET players = :players",
    ExpressionAttributeValues: {
      ":players": { L: updatedPlayers.map((id: string) => ({ S: id })) },
    },
    ReturnValues: "ALL_NEW",
  });
  return await db.send(command);
};

export const setRoom = async (
  roomId: string,
  settings: { minPlayer?: number; status?: string }
) => {
  let updateExpression = "SET";
  const expressionAttributeValues: Record<string, AttributeValue> = {};
  const expressionAttributeNames: Record<string, string> = {};
  
  const updates: string[] = [];
  
  if (settings.minPlayer !== undefined) {
    updates.push("minPlayer = :minPlayer");
    expressionAttributeValues[":minPlayer"] = { N: String(settings.minPlayer) };
  }
  
  if (settings.status) {
    updates.push("#status = :status");
    expressionAttributeValues[":status"] = { S: settings.status };
    expressionAttributeNames["#status"] = "status";
  }
  
  updateExpression += " " + updates.join(", ");

  const command = new UpdateItemCommand({
    TableName: "Rooms",
    Key: {
      id: { S: roomId },
    },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionAttributeValues,
    ...(Object.keys(expressionAttributeNames).length > 0 && {
      ExpressionAttributeNames: expressionAttributeNames,
    }),
    ReturnValues: "UPDATED_NEW",
  });

  return await db.send(command);
};

export const startGame = async (roomId: string) => {
  return await setRoom(roomId, { status: "starting" });
};
