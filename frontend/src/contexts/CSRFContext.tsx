import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import axios from 'axios';

interface CSRFContextType {
  csrfToken: string | null;
  isLoading: boolean;
  error: string | null;
  refreshToken: () => Promise<void>;
}

const CSRFContext = createContext<CSRFContextType | undefined>(undefined);

export const useCSRF = () => {
  const context = useContext(CSRFContext);
  if (!context) {
    throw new Error('useCSRF must be used within CSRFProvider');
  }
  return context;
};

interface CSRFProviderProps {
  children: ReactNode;
}

export const CSRFProvider: React.FC<CSRFProviderProps> = ({ children }) => {
  const [csrfToken, setCSRFToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshToken = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await axios.get('/api/init-csrf', {
        withCredentials: true, // Cookieを送受信するために必要
      });
      
      if (response.data.success && response.data.token) {
        setCSRFToken(response.data.token);
        
        // axiosのデフォルトヘッダーにCSRFトークンを設定
        axios.defaults.headers.common['X-CSRF-Token'] = response.data.token;
      } else {
        throw new Error('Failed to get CSRF token');
      }
    } catch (err) {
      setError('Failed to initialize CSRF protection');
    } finally {
      setIsLoading(false);
    }
  };

  // 初回マウント時にトークンを取得
  useEffect(() => {
    refreshToken();
  }, []);

  // axiosインターセプターを設定
  useEffect(() => {
    // リクエストインターセプター
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        // S3へのリクエストは除外
        const isS3Request = config.url?.includes('.s3.') || config.url?.includes('.s3-');
        const isApiRequest = config.url?.startsWith('/api') || config.url?.includes('/api/');
        
        // APIリクエストの場合のみCSRF保護を適用
        if (isApiRequest && !isS3Request) {
          // CSRFトークンが存在し、変更を伴うメソッドの場合はヘッダーに追加
          if (csrfToken && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(config.method?.toUpperCase() || '')) {
            config.headers['X-CSRF-Token'] = csrfToken;
          }
          // Cookieを送信するための設定
          config.withCredentials = true;
        }
        
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // レスポンスインターセプター（CSRF検証エラーの処理）
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 403 && error.response?.data?.error?.message === 'CSRF validation failed') {
          // CSRFトークンが無効な場合は再取得
          await refreshToken();
          
          // 元のリクエストを再試行
          const originalRequest = error.config;
          if (!originalRequest._retry) {
            originalRequest._retry = true;
            return axios(originalRequest);
          }
        }
        return Promise.reject(error);
      }
    );

    // クリーンアップ
    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, [csrfToken]);

  return (
    <CSRFContext.Provider value={{ csrfToken, isLoading, error, refreshToken }}>
      {children}
    </CSRFContext.Provider>
  );
};