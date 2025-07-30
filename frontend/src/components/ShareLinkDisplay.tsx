import React, { useState } from 'react';

interface ShareLinkDisplayProps {
  shareUrl: string;
  fileName: string;
  expiresAt: string;
  onNewUpload: () => void;
}

const ShareLinkDisplay: React.FC<ShareLinkDisplayProps> = ({
  shareUrl,
  fileName,
  expiresAt,
  onNewUpload
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatExpiryDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="space-y-4">
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4">
        <div className="flex items-start">
          <svg
            className="h-5 w-5 text-green-400 dark:text-green-500 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-green-800 dark:text-green-300">Upload successful!</h3>
            <p className="mt-1 text-sm text-green-700 dark:text-green-400">
              {fileName} has been uploaded successfully.
            </p>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Share Link
        </label>
        <div className="flex space-x-2">
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
          />
          <button
            onClick={handleCopy}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-400">
        <p>This link will expire on: <strong>{formatExpiryDate(expiresAt)}</strong></p>
        <p className="mt-1">The file will be automatically deleted after expiration.</p>
      </div>

      <button
        onClick={onNewUpload}
        className="w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
      >
        Upload Another File
      </button>
    </div>
  );
};

export default ShareLinkDisplay;