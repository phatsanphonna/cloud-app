import { GetItemCommand, PutItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { db } from "../database";
import { v4 as uuidv4 } from "uuid";
import { generateProfilePicture } from "../user/profile-generator";

export const getUserByUUID = async (uuid: string) => {
  const command = new GetItemCommand({
    TableName: "Users",
    Key: {
      id: { S: uuid },
    },
  });
  return db.send(command);
}

export const getUserByUsername = async (username: string) => {
  const command = new QueryCommand({
    TableName: "Users",
    IndexName: "UsernameIndex", // GSI name
    KeyConditionExpression: "username = :u",
    ExpressionAttributeValues: {
      ":u": { S: username },
    },
  });

  const result = await db.send(command);
  return { Item: result.Items?.[0] }; // usernames should be unique
}

export const createUser = async (username: string) => {
  const command = new PutItemCommand({
    TableName: "Users",
    Item: {
      id: { S: uuidv4() },
      username: { S: username },
      money: { N: "50" },
      profilePicture: { S: generateProfilePicture() },
    },
  });
  return db.send(command);
}