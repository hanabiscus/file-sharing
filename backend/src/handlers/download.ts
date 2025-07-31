import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ErrorResponse, ErrorCode } from "../types/api";
import { getFileRecord, incrementDownloadCount } from "../utils/dynamodb";
import { getPresignedDownloadUrl } from "../utils/s3";
import { verifyPassword } from "../utils/crypto";
import { checkRateLimit, recordAttempt } from "../utils/rateLimiter";
import {
  createSecureResponse,
  validateEnvironment,
  secureLogger,
} from "../utils/security";

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const origin = event.headers.origin || event.headers.Origin;

  try {
    validateEnvironment();
    const shareId = event.pathParameters?.shareId;

    if (!shareId) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "Share ID is required",
        origin
      );
    }

    // Get file record from DynamoDB
    const fileRecord = await getFileRecord(shareId);

    if (!fileRecord) {
      return createErrorResponse(
        ErrorCode.FILE_NOT_FOUND,
        "File not found or has expired",
        origin
      );
    }

    // Check if file has expired
    const currentTime = Math.floor(Date.now() / 1000);
    if (fileRecord.expiresAt < currentTime) {
      return createErrorResponse(
        ErrorCode.FILE_NOT_FOUND,
        "File has expired",
        origin
      );
    }

    // Check password if protected
    if (fileRecord.passwordHash) {
      const body = event.body ? JSON.parse(event.body) : {};
      const password = body.password;

      if (!password) {
        return createErrorResponse(
          ErrorCode.INVALID_PASSWORD,
          "Password is required",
          origin
        );
      }

      // Get client IP for rate limiting
      // Try multiple headers to get the real client IP (CloudFront, API Gateway, etc.)
      const clientIp =
        event.headers["X-Forwarded-For"]?.split(",")[0].trim() ||
        event.headers["x-forwarded-for"]?.split(",")[0].trim() ||
        event.requestContext.identity.sourceIp ||
        "unknown";

      // Check rate limit
      const rateLimitResult = await checkRateLimit(shareId, clientIp);
      if (!rateLimitResult.allowed) {
        const message = "Too many failed attempts. Please try again later.";
        return createErrorResponse(
          ErrorCode.RATE_LIMITED,
          message,
          origin,
          429
        );
      }

      const isValidPassword = await verifyPassword(
        password,
        fileRecord.passwordHash
      );

      // Record attempt
      await recordAttempt(shareId, clientIp, isValidPassword);

      if (!isValidPassword) {
        // After recording the failed attempt, we need to calculate the actual remaining attempts
        // Since we just recorded a failed attempt, decrease by 1
        const actualRemaining = rateLimitResult.remainingAttempts
          ? rateLimitResult.remainingAttempts - 1
          : 0;
        const message =
          actualRemaining > 0
            ? `Invalid password. ${actualRemaining} attempts remaining.`
            : "Invalid password. No attempts remaining.";
        return createErrorResponse(ErrorCode.INVALID_PASSWORD, message, origin);
      }
    }

    // Generate presigned URL for download
    const downloadUrl = await getPresignedDownloadUrl(
      fileRecord.s3Key,
      fileRecord.originalFilename
    );

    // Increment download count
    await incrementDownloadCount(shareId);

    return createSecureResponse(
      200,
      {
        success: true,
        downloadUrl,
        fileName: fileRecord.originalFilename,
        fileSize: fileRecord.fileSize,
        mimeType: fileRecord.mimeType,
      },
      origin
    );
  } catch (error) {
    // Log error without sensitive details
    console.error("Download error:", {
      message: error instanceof Error ? error.message : "Unknown error",
      // Do not log share IDs or sensitive data
    });
    return createErrorResponse(
      ErrorCode.STORAGE_ERROR,
      "Failed to generate download link",
      origin
    );
  }
}

function createErrorResponse(
  code: ErrorCode,
  message: string,
  origin?: string,
  customStatusCode?: number
): APIGatewayProxyResult {
  const response: ErrorResponse = {
    success: false,
    error: { code, message },
  };

  const statusCode =
    customStatusCode ||
    (code === ErrorCode.FILE_NOT_FOUND
      ? 404
      : code === ErrorCode.INVALID_PASSWORD
      ? 401
      : code === ErrorCode.RATE_LIMITED
      ? 429
      : 400);

  return createSecureResponse(statusCode, response, origin);
}
