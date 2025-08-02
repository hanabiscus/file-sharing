import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { FileInfoResponse } from '../types/api';
import { formatFileSize } from '../utils/formatters';
import { getApiUrl } from '../config/api';
import ErrorMessage from './ErrorMessage';

const DownloadPage: React.FC = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const [fileInfo, setFileInfo] = useState<FileInfoResponse | null>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  useEffect(() => {
    fetchFileInfo();
  }, [shareId]);

  const fetchFileInfo = async () => {
    if (!shareId) return;

    try {
      const response = await axios.get<FileInfoResponse>(getApiUrl(`file/${shareId}`));
      if (response.data.success) {
        setFileInfo(response.data);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || 'Failed to load file information';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!shareId) return;

    setDownloading(true);
    setError(null);

    try {
      // Step 1: Get download token
      const tokenResponse = await axios.post(getApiUrl(`download/${shareId}`), 
        fileInfo?.isPasswordProtected ? { password } : {},
        { 
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (tokenResponse.data.success && tokenResponse.data.downloadToken) {
        // Step 2: Use token to get actual download URL
        const downloadResponse = await axios.post(
          getApiUrl(`download/${shareId}?token=${tokenResponse.data.downloadToken}`),
          {},
          { 
            headers: { 'Content-Type': 'application/json' }
          }
        );

        if (downloadResponse.data.success && downloadResponse.data.downloadUrl) {
          // Create a temporary link and click it to download
          const link = document.createElement('a');
          link.href = downloadResponse.data.downloadUrl;
          link.download = downloadResponse.data.fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || 'Download failed';
      setError(errorMessage);
      
      // Extract remaining attempts from error message
      const attemptsMatch = errorMessage.match(/(\d+) attempts? remaining/);
      if (attemptsMatch) {
        setRemainingAttempts(parseInt(attemptsMatch[1]));
      } else if (errorMessage.includes('Too many failed attempts')) {
        setRemainingAttempts(0);
      }
      
      // Clear password on failed attempt
      if (err.response?.status === 401 || err.response?.status === 429) {
        setPassword('');
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
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6" role="status" aria-label="Loading">
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
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">File Not Found</h2>
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
        <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-gray-100">Download File</h2>

        {fileInfo && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">{fileInfo.fileName}</h3>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Size:</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{formatFileSize(fileInfo.fileSize)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Uploaded:</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{formatDate(fileInfo.uploadedAt)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Expires:</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{formatDate(fileInfo.expiresAt)}</dd>
                </div>
              </dl>
            </div>

            {fileInfo.isPasswordProtected && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Password Required
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={downloading || remainingAttempts === 0}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 sm:text-sm disabled:bg-gray-100 dark:disabled:bg-gray-800"
                  placeholder="Enter password"
                />
                {remainingAttempts !== null && remainingAttempts > 0 && remainingAttempts < 5 && (
                  <p className="mt-1 text-sm text-yellow-600 dark:text-yellow-400">
                    {remainingAttempts} {remainingAttempts === 1 ? 'attempt' : 'attempts'} remaining
                  </p>
                )}
                {remainingAttempts === 0 && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    Too many failed attempts. Please try again later.
                  </p>
                )}
              </div>
            )}

            {error && <ErrorMessage message={error} />}

            <button
              onClick={handleDownload}
              disabled={downloading || (fileInfo.isPasswordProtected && !password) || remainingAttempts === 0}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
            >
              {downloading ? 'Preparing Download...' : remainingAttempts === 0 ? 'Access Blocked' : 'Download File'}
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