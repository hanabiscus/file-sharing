import * as crypto from 'crypto';
import { APIGatewayProxyEvent } from 'aws-lambda';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const COOKIE_MAX_AGE = 24 * 60 * 60; // 24時間

// 暗号化キー（環境変数から取得）
const getEncryptionKey = (): Buffer => {
  const key = process.env.CSRF_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('CSRF_ENCRYPTION_KEY environment variable is not set');
  }
  // Base64エンコードされた32バイトのキーを期待
  return Buffer.from(key, 'base64');
};

// トークンの暗号化
function encryptToken(token: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // IV + AuthTag + 暗号化データを結合
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

// トークンの復号化
function decryptToken(encryptedData: string): string | null {
  try {
    const key = getEncryptionKey();
    const parts = encryptedData.split(':');
    
    if (parts.length !== 3) {
      return null;
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt CSRF token:', error);
    return null;
  }
}

// CSRFトークンの生成とCookieの作成
export function generateCSRFCookie(): { token: string; cookie: string } {
  // ランダムなトークンを生成
  const token = crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
  
  // トークンを暗号化
  const encryptedToken = encryptToken(token);
  
  // Cookieの作成
  const cookieOptions = [
    `${CSRF_COOKIE_NAME}=${encryptedToken}`,
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    `Max-Age=${COOKIE_MAX_AGE}`,
    'Path=/'
  ];
  
  return {
    token,
    cookie: cookieOptions.join('; ')
  };
}

// リクエストからCSRFトークンを抽出
export function extractCSRFToken(event: APIGatewayProxyEvent): {
  cookieToken: string | null;
  headerToken: string | null;
} {
  // Cookieからトークンを取得
  const cookies = event.headers.cookie || event.headers.Cookie || '';
  const cookieMatch = cookies.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
  const encryptedToken = cookieMatch ? cookieMatch[1] : null;
  const cookieToken = encryptedToken ? decryptToken(encryptedToken) : null;
  
  // ヘッダーからトークンを取得
  const headerToken = event.headers[CSRF_HEADER_NAME] || event.headers[CSRF_HEADER_NAME.toUpperCase()] || null;
  
  return { cookieToken, headerToken };
}

// CSRF検証
export function validateCSRFToken(event: APIGatewayProxyEvent): boolean {
  // GET、HEAD、OPTIONSリクエストはCSRF検証をスキップ
  const method = event.httpMethod.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return true;
  }
  
  const { cookieToken, headerToken } = extractCSRFToken(event);
  
  // 両方のトークンが存在し、一致することを確認
  if (!cookieToken || !headerToken) {
    return false;
  }
  
  // タイミング攻撃を防ぐため、crypto.timingSafeEqualを使用
  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);
  
  if (cookieBuffer.length !== headerBuffer.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(cookieBuffer, headerBuffer);
}

// API Gatewayのレスポンスにセキュリティヘッダーを追加
export function addSecurityHeaders(headers: { [key: string]: string | number | boolean }, includeCSRF: boolean = false): { [key: string]: string | number | boolean } {
  const securityHeaders: { [key: string]: string | number | boolean } = {
    ...headers,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  };
  
  if (includeCSRF) {
    const { token, cookie } = generateCSRFCookie();
    securityHeaders['Set-Cookie'] = cookie;
    // CSRFトークンをカスタムヘッダーで返す（クライアントが読み取れるように）
    securityHeaders['X-CSRF-Token'] = token;
  }
  
  return securityHeaders;
}