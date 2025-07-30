import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommandInput,
  GetObjectCommandInput,
  DeleteObjectCommandInput,
  ListObjectsV2CommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Initialize S3 client with explicit region
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-northeast-1",
});
const BUCKET_NAME = process.env.S3_BUCKET_NAME || "filelair-files";
const PRESIGNED_URL_EXPIRY = 3600; // 1 hour

export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType: string
): Promise<void> {
  const params: PutObjectCommandInput = {
    Bucket: BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
    ServerSideEncryption: "AES256",
  };

  await s3Client.send(new PutObjectCommand(params));
}

export async function createPresignedUploadUrl(
  key: string,
  contentType: string
): Promise<string> {
  try {
    const params: PutObjectCommandInput = {
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    };

    const command = new PutObjectCommand(params);

    // Generate presigned URL
    const url = await getSignedUrl(s3Client, command, {
      expiresIn: PRESIGNED_URL_EXPIRY,
    });

    console.log("Generated presigned URL:", {
      bucket: BUCKET_NAME,
      keyPrefix: key.substring(0, 20) + "...",
      contentType: contentType,
      expiresIn: PRESIGNED_URL_EXPIRY,
      region: process.env.AWS_REGION || "ap-northeast-1",
    });

    return url;
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    throw new Error(
      `Failed to generate upload URL: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function getPresignedDownloadUrl(
  key: string,
  filename: string
): Promise<string> {
  // RFC 5987 compliant encoding for non-ASCII filenames
  const encodedFilename = encodeURIComponent(filename);
  const asciiFilename = filename.replace(/[^\x00-\x7F]/g, "_"); // Fallback for ASCII-only clients

  // Use both filename and filename* for maximum compatibility
  const contentDisposition = `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`;

  const params: GetObjectCommandInput = {
    Bucket: BUCKET_NAME,
    Key: key,
    ResponseContentDisposition: contentDisposition,
  };

  const command = new GetObjectCommand(params);
  return getSignedUrl(s3Client, command, { expiresIn: PRESIGNED_URL_EXPIRY });
}

export async function deleteFile(key: string): Promise<void> {
  const params: DeleteObjectCommandInput = {
    Bucket: BUCKET_NAME,
    Key: key,
  };

  await s3Client.send(new DeleteObjectCommand(params));
}

export async function listExpiredFiles(prefix: string): Promise<string[]> {
  const params: ListObjectsV2CommandInput = {
    Bucket: BUCKET_NAME,
    Prefix: prefix,
  };

  const result = await s3Client.send(new ListObjectsV2Command(params));
  return result.Contents?.map((obj) => obj.Key!).filter(Boolean) || [];
}
