import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { FileInfoResponse, ErrorCode, ErrorResponse } from "../types/api";
import { formatFileSize } from "../utils/formatters";
import { getApiUrl } from "../config/api";
import ErrorMessage from "./ErrorMessage";

const DownloadPage: React.FC = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const [fileInfo, setFileInfo] = useState<FileInfoResponse | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(
    null
  );

  useEffect(() => {
    fetchFileInfo();
  }, [shareId]);

  const fetchFileInfo = async () => {
    if (!shareId) return;

    try {
      const response = await axios.get<FileInfoResponse>(
        getApiUrl(`file/${shareId}`)
      );

      // Check if the response is actually an error (CloudFront may convert 404 to 200)
      if (response.data && "error" in response.data) {
        const errorData = response.data as any;
        setError(errorData.error?.message || "Failed to load file information");
      } else if (response.data && response.data.success === false) {
        // Handle error response with success: false
        const errorData = response.data as any;
        setError(errorData.error?.message || "Failed to load file information");
      } else {
        setFileInfo(response.data);
      }
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error?.message || "Failed to load file information";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!shareId) return;

    setDownloading(true);
    setError(null);
    setErrorCode(null);

    try {
      // Step 1: Get download token
      const tokenResponse = await axios.post(
        getApiUrl(`download/${shareId}`),
        fileInfo?.isPasswordProtected ? { password } : {},
        {
          headers: { "Content-Type": "application/json" },
        }
      );

      // Check if response indicates an error (even with 2xx status)
      if (!tokenResponse.data.success) {
        const errorResponse = tokenResponse.data as ErrorResponse;
        const errorMessage = errorResponse.error?.message || "Download failed";
        const code = errorResponse.error?.code;
        
        setError(errorMessage);
        setErrorCode(code as ErrorCode || null);
        
        // Handle specific error codes
        if (code === ErrorCode.RATE_LIMITED) {
          setRemainingAttempts(0);
        }
        if (code === ErrorCode.INVALID_PASSWORD) {
          setPassword("");
        }
        
        return; // Exit early for error responses
      }

      if (tokenResponse.data.success && tokenResponse.data.downloadToken) {
        // Step 2: Use token to get actual download URL
        const downloadResponse = await axios.post(
          getApiUrl(
            `download/${shareId}?token=${tokenResponse.data.downloadToken}`
          ),
          {},
          {
            headers: { "Content-Type": "application/json" },
          }
        );

        // Also check download response for errors
        if (!downloadResponse.data.success) {
          const errorResponse = downloadResponse.data as ErrorResponse;
          const errorMessage = errorResponse.error?.message || "Download failed";
          const code = errorResponse.error?.code;
          
          setError(errorMessage);
          setErrorCode(code as ErrorCode || null);
          return;
        }

        if (
          downloadResponse.data.success &&
          downloadResponse.data.downloadUrl
        ) {
          // Create a temporary link and click it to download
          const link = document.createElement("a");
          link.href = downloadResponse.data.downloadUrl;
          link.download = downloadResponse.data.fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
    } catch (err: any) {
      const errorResponse = err.response?.data as ErrorResponse;
      const errorMessage = errorResponse?.error?.message || "Download failed";
      const code = errorResponse?.error?.code;
      
      setError(errorMessage);
      setErrorCode(code as ErrorCode || null);

      // Check if rate limited
      if (code === ErrorCode.RATE_LIMITED || errorMessage.includes("Too many failed attempts")) {
        setRemainingAttempts(0);
      }

      // Clear password on failed attempt
      if (code === ErrorCode.INVALID_PASSWORD || err.response?.status === 401 || err.response?.status === 429) {
        setPassword("");
      }
    } finally {
      setDownloading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div
          className="bg-white dark:bg-gray-800 shadow rounded-lg p-6"
          role="status"
          aria-label="Loading"
        >
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !fileInfo) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
            File Not Found
          </h2>
          <ErrorMessage message={error} />
          <div className="mt-4">
            <a
              href="/"
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
            >
              ← Back to upload
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-gray-100">
          Download File
        </h2>

        {fileInfo && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                {fileInfo.fileName}
              </h3>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Size:</dt>
                  <dd className="text-gray-900 dark:text-gray-100">
                    {formatFileSize(fileInfo.fileSize)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">
                    Uploaded:
                  </dt>
                  <dd className="text-gray-900 dark:text-gray-100">
                    {formatDate(fileInfo.uploadedAt)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Expires:</dt>
                  <dd className="text-gray-900 dark:text-gray-100">
                    {formatDate(fileInfo.expiresAt)}
                  </dd>
                </div>
              </dl>
            </div>

            {fileInfo.isPasswordProtected && (
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Password Required
                </label>
                <div className="relative mt-1">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={downloading || remainingAttempts === 0}
                    className="block w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 sm:text-sm disabled:bg-gray-100 dark:disabled:bg-gray-800"
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 px-3 flex items-center"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg className="h-5 w-5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    )}
                  </button>
                </div>
                {remainingAttempts === 0 && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    Too many failed attempts. Please try again later.
                  </p>
                )}
              </div>
            )}

            {error && <ErrorMessage message={error} code={errorCode} />}

            <button
              onClick={handleDownload}
              disabled={
                downloading ||
                (fileInfo.isPasswordProtected && !password) ||
                remainingAttempts === 0 ||
                errorCode === ErrorCode.ACCESS_DENIED
              }
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
            >
              {downloading
                ? "Preparing Download..."
                : remainingAttempts === 0
                ? "Access Blocked"
                : errorCode === ErrorCode.ACCESS_DENIED
                ? "File Unavailable"
                : errorCode === ErrorCode.SCAN_PENDING
                ? "Scan in Progress"
                : "Download File"}
            </button>

            <div className="text-center">
              <a
                href="/"
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
              >
                Upload a new file
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DownloadPage;
