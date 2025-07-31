import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = "filelair";

interface RateLimitRecord {
  pk: string;
  attempts: number;
  blockedUntil?: number;
  lastAttempt: number;
}

const MAX_ATTEMPTS = 5;
const BLOCK_DURATION = 15 * 60; // 15 minutes in seconds
const ATTEMPT_WINDOW = 60 * 60; // 1 hour in seconds

export async function checkRateLimit(
  shareId: string,
  ipAddress: string
): Promise<{
  allowed: boolean;
  remainingAttempts?: number;
  blockedUntil?: Date;
}> {
  const rateLimitKey = `RATELIMIT#${shareId}#${ipAddress}`;
  const currentTime = Math.floor(Date.now() / 1000);

  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { shareId: rateLimitKey },
      })
    );

    if (!result.Item) {
      // First attempt
      return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
    }

    const record = result.Item as RateLimitRecord;

    // Check if blocked
    if (record.blockedUntil && record.blockedUntil > currentTime) {
      return {
        allowed: false,
        blockedUntil: new Date(record.blockedUntil * 1000),
      };
    }

    // Check if outside attempt window (reset attempts)
    if (record.lastAttempt < currentTime - ATTEMPT_WINDOW) {
      return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
    }

    // Check attempts
    if (record.attempts >= MAX_ATTEMPTS) {
      // Block the user
      await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { shareId: rateLimitKey },
          UpdateExpression: "SET blockedUntil = :blockedUntil",
          ExpressionAttributeValues: {
            ":blockedUntil": currentTime + BLOCK_DURATION,
          },
        })
      );

      return {
        allowed: false,
        blockedUntil: new Date((currentTime + BLOCK_DURATION) * 1000),
      };
    }

    return {
      allowed: true,
      remainingAttempts: MAX_ATTEMPTS - record.attempts,
    };
  } catch (error) {
    console.error("Rate limit check error:", error);
    // SECURITY: Fail closed to prevent bypass during DynamoDB failures
    return {
      allowed: false,
      blockedUntil: new Date(Date.now() + 60000), // Block for 1 minute on error
    };
  }
}

export async function recordAttempt(
  shareId: string,
  ipAddress: string,
  success: boolean
): Promise<void> {
  const rateLimitKey = `RATELIMIT#${shareId}#${ipAddress}`;
  const currentTime = Math.floor(Date.now() / 1000);
  const expiresAt = currentTime + ATTEMPT_WINDOW;

  try {
    if (success) {
      // Reset attempts on successful authentication
      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            shareId: rateLimitKey,
            attempts: 0,
            lastAttempt: currentTime,
            expiresAt,
          },
        })
      );
    } else {
      // Increment attempts on failure
      await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { shareId: rateLimitKey },
          UpdateExpression:
            "SET attempts = if_not_exists(attempts, :zero) + :one, lastAttempt = :lastAttempt, expiresAt = :expiresAt",
          ExpressionAttributeValues: {
            ":zero": 0,
            ":one": 1,
            ":lastAttempt": currentTime,
            ":expiresAt": expiresAt,
          },
        })
      );
    }
  } catch (error) {
    console.error("Record attempt error:", error);
    // Don't throw - rate limiting should not break the main flow
  }
}
