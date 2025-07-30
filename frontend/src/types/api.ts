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

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export type ApiResponse<T> = T | ErrorResponse;