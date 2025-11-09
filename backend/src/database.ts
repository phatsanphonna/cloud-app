import { DynamoDBClient, CreateTableCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// Use AWS DynamoDB (remove endpoint and dummy creds for AWS)
const client = new DynamoDBClient({
  region: "us-east-1", // Use actual AWS region
  // Remove endpoint and credentials to use AWS
  // endpoint: "http://localhost:8000",
  // credentials: {
  //   accessKeyId: "dummy",
  //   secretAccessKey: "dummy",
  // },
});

export const db = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});