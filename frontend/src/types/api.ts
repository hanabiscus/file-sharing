export interface UploadResponse {
  success: boolean;
  shareId: string;
  shareUrl: string;
  uploadUrl?: string;
  expiresAt: string;
  fileName: string;
  fileSize: number;
}

export interface FileInfoResponse {
  success: boolean;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  expiresAt: string;
  isPasswordProtected: boolean;
}

export enum ErrorCode {
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
  RATE_LIMITED = 'RATE_LIMITED',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  STORAGE_ERROR = 'STORAGE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  ACCESS_DENIED = 'ACCESS_DENIED',
  SCAN_PENDING = 'SCAN_PENDING'
}

export interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode | string;
    message: string;
    details?: any;
  };
}

export type ApiResponse<T> = T | ErrorResponse;