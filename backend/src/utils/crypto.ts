import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export function generateShareId(): string {
  return randomBytes(16).toString('hex');
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateS3Key(shareId: string, filename: string): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  // Sanitize filename to prevent path traversal
  const sanitizedFilename = sanitizeFilename(filename);
  
  // Structure: year/month/day/shareId/filename
  return `${year}/${month}/${day}/${shareId}/${sanitizedFilename}`;
}

function sanitizeFilename(filename: string): string {
  // Remove any path traversal attempts
  let sanitized = filename.replace(/\.\.\/|\.\.\\|\.\.$/g, '_');
  
  // Remove leading slashes/backslashes
  sanitized = sanitized.replace(/^[\/\\]+/, '');
  
  // Remove any remaining path separators to ensure filename only
  sanitized = sanitized.replace(/[\/\\]/g, '_');
  
  // Remove null bytes and other dangerous characters
  sanitized = sanitized.replace(/\x00/g, '');
  
  // Limit filename length
  const maxLength = 255;
  if (sanitized.length > maxLength) {
    const ext = sanitized.lastIndexOf('.');
    if (ext > 0) {
      const name = sanitized.substring(0, ext);
      const extension = sanitized.substring(ext);
      sanitized = name.substring(0, maxLength - extension.length) + extension;
    } else {
      sanitized = sanitized.substring(0, maxLength);
    }
  }
  
  // If filename is empty after sanitization, generate a safe default
  if (!sanitized || sanitized.trim() === '') {
    sanitized = `file_${Date.now()}`;
  }
  
  return sanitized;
}