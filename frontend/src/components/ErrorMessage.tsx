import React from 'react';
import { ErrorCode } from '../types/api';

interface ErrorMessageProps {
  message: string;
  code?: ErrorCode | string | null;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, code }) => {
  if (code === ErrorCode.ACCESS_DENIED) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400 dark:text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
              Access Denied
            </h3>
            <div className="mt-1 text-sm text-red-700 dark:text-red-400">
              <p>{message}</p>
              <p className="mt-1 text-xs text-red-600 dark:text-red-500">
                This file has been removed for security reasons.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (code === ErrorCode.SCAN_PENDING) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400 dark:text-yellow-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
              Security Scan in Progress
            </h3>
            <div className="mt-1 text-sm text-yellow-700 dark:text-yellow-400">
              <p>{message}</p>
              <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-500">
                Please refresh this page in a few moments to try again.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default error display
  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
      <div className="flex">
        <svg
          className="h-5 w-5 text-red-400 dark:text-red-500"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
        <p className="ml-3 text-sm text-red-700 dark:text-red-300">{message}</p>
      </div>
    </div>
  );
};

export default ErrorMessage;