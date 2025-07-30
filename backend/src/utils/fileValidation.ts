import { UPLOAD_CONFIG } from '../types/models';
import { ErrorCode } from '../types/api';

export interface FileValidationResult {
  isValid: boolean;
  error?: {
    code: ErrorCode;
    message: string;
  };
}

export function validateFileExtension(filename: string): FileValidationResult {
  const extension = filename.toLowerCase().match(/\.[^.]*$/)?.[0] || '';
  
  if (!extension) {
    return {
      isValid: false,
      error: {
        code: ErrorCode.INVALID_FILE_TYPE,
        message: 'File must have an extension'
      }
    };
  }

  if (!UPLOAD_CONFIG.allowedExtensions.includes(extension)) {
    return {
      isValid: false,
      error: {
        code: ErrorCode.INVALID_FILE_TYPE,
        message: `File type ${extension} is not allowed. Allowed types: ${UPLOAD_CONFIG.allowedExtensions.join(', ')}`
      }
    };
  }

  return { isValid: true };
}

export function validateMimeType(mimeType: string): FileValidationResult {
  // Allow empty MIME type or application/octet-stream as fallback
  if (!mimeType || mimeType === 'application/octet-stream') {
    return { isValid: true };
  }

  if (!UPLOAD_CONFIG.allowedMimeTypes.includes(mimeType)) {
    return {
      isValid: false,
      error: {
        code: ErrorCode.INVALID_FILE_TYPE,
        message: `MIME type ${mimeType} is not allowed`
      }
    };
  }

  return { isValid: true };
}

export function validateFileSize(size: number): FileValidationResult {
  if (size <= 0) {
    return {
      isValid: false,
      error: {
        code: ErrorCode.FILE_TOO_LARGE,
        message: 'File size must be greater than 0'
      }
    };
  }

  if (size > UPLOAD_CONFIG.maxFileSize) {
    const maxSizeMB = UPLOAD_CONFIG.maxFileSize / (1024 * 1024);
    const actualSizeMB = (size / (1024 * 1024)).toFixed(2);
    return {
      isValid: false,
      error: {
        code: ErrorCode.FILE_TOO_LARGE,
        message: `File size ${actualSizeMB}MB exceeds maximum allowed size of ${maxSizeMB}MB`
      }
    };
  }

  return { isValid: true };
}

export function validateFile(filename: string, mimeType: string, size: number): FileValidationResult {
  // Validate extension
  const extensionResult = validateFileExtension(filename);
  if (!extensionResult.isValid) {
    return extensionResult;
  }

  // Validate MIME type
  const mimeResult = validateMimeType(mimeType);
  if (!mimeResult.isValid) {
    return mimeResult;
  }

  // Validate size
  const sizeResult = validateFileSize(size);
  if (!sizeResult.isValid) {
    return sizeResult;
  }

  return { isValid: true };
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}