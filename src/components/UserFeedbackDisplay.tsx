/**
 * 用户反馈显示组件
 * 显示错误信息、警告、进度和操作反馈
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
  Loader,
} from 'lucide-react';
import {
  userFeedbackHandler,
  FeedbackAction,
  FeedbackMessage,
  ProgressInfo,
} from '../services/UserFeedbackHandler';
import { logger } from '../utils/logger';

interface UserFeedbackDisplayProps {
  className?: string;
}

export const UserFeedbackDisplay: React.FC<UserFeedbackDisplayProps> = ({
  className = '',
}) => {
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);

  useEffect(() => {
    // 订阅消息变化
    const unsubscribeMessages =
      userFeedbackHandler.onMessagesChange(setMessages);

    // 订阅进度变化
    const unsubscribeProgress =
      userFeedbackHandler.onProgressChange(setProgress);

    return () => {
      unsubscribeMessages();
      unsubscribeProgress();
    };
  }, []);

  const getMessageIcon = (type: FeedbackMessage['type']) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />;
      case 'loading':
        return <Loader className="h-5 w-5 animate-spin text-blue-500" />;
      default:
        return <Info className="h-5 w-5 text-gray-500" />;
    }
  };

  const getMessageStyles = (type: FeedbackMessage['type']) => {
    switch (type) {
      case 'error':
        return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800';
      case 'success':
        return 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800';
      case 'loading':
        return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 dark:bg-gray-900/20 dark:border-gray-800';
    }
  };

  const getButtonStyles = (type: 'primary' | 'secondary' | 'danger') => {
    switch (type) {
      case 'primary':
        return 'bg-blue-600 hover:bg-blue-700 text-white';
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 text-white';
      case 'secondary':
      default:
        return 'bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200';
    }
  };

  const handleMessageClose = (messageId: string) => {
    userFeedbackHandler.removeMessage(messageId);
  };

  const handleActionClick = async (action: FeedbackAction) => {
    try {
      await action.handler();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('USER_FEEDBACK', '操作执行失败', undefined, err);
    }
  };

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-md space-y-3 ${className}`}>
      {/* 进度指示器 */}
      {progress && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center space-x-3">
            <Loader className="h-5 w-5 animate-spin text-blue-500" />
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {progress.operation}
              </div>
              {progress.message && (
                <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                  {progress.message}
                </div>
              )}
              {progress.progress !== undefined && !progress.isIndeterminate && (
                <div className="mt-2">
                  <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-2 rounded-full bg-blue-600 transition-[width] duration-300"
                      style={{ width: `${progress.progress}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    {Math.round(progress.progress)}%
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 消息列表 */}
      {messages.map((message) => (
        <div
          key={message.id}
          className={`rounded-lg border p-4 shadow-lg ${getMessageStyles(message.type)} animate-slide-in-right`}
        >
          <div className="flex items-start space-x-3">
            <div className="mt-0.5 shrink-0">
              {getMessageIcon(message.type)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {message.title}
              </div>
              <div className="mt-1 text-sm whitespace-pre-wrap text-gray-600 dark:text-gray-300">
                {message.message}
              </div>

              {/* 操作按钮 */}
              {message.actions && message.actions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {message.actions.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => handleActionClick(action)}
                      className={`rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${getButtonStyles(action.type)}`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 关闭按钮 */}
            {!message.persistent && (
              <button
                onClick={() => handleMessageClose(message.id)}
                className="shrink-0 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// 添加动画样式
const styles = `
  @keyframes slide-in-right {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  .animate-slide-in-right {
    animation: slide-in-right 0.3s ease-out;
  }
`;

// 注入样式
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}
