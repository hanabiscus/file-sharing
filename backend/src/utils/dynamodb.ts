import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  PutCommandInput,
  GetCommandInput,
  UpdateCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { FileRecord } from "../types/models";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "filelair";

export async function saveFileRecord(record: FileRecord): Promise<void> {
  const params: PutCommandInput = {
    TableName: TABLE_NAME,
    Item: record,
  };

  await docClient.send(new PutCommand(params));
}

export async function getFileRecord(
  shareId: string
): Promise<FileRecord | null> {
  const params: GetCommandInput = {
    TableName: TABLE_NAME,
    Key: {
      shareId,
    },
  };

  const result = await docClient.send(new GetCommand(params));
  return (result.Item as FileRecord) || null;
}

export async function incrementDownloadCount(shareId: string): Promise<void> {
  const params: UpdateCommandInput = {
    TableName: TABLE_NAME,
    Key: {
      shareId,
    },
    UpdateExpression: "SET downloadCount = downloadCount + :inc",
    ExpressionAttributeValues: {
      ":inc": 1,
    },
  };

  await docClient.send(new UpdateCommand(params));
}
