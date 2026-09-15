import React, { useState } from 'react';
import { useRoomContext } from '../../contexts/RoomContext';

interface ShareLinkProps {
  className?: string;
}

const ShareLink: React.FC<ShareLinkProps> = ({ className = '' }) => {
  const { room } = useRoomContext();
  const [copied, setCopied] = useState(false);

  if (!room) return null;

  const url = `${window.location.origin}/room/${room.id}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Connection 모임 초대',
          text: '실시간 위치를 공유하는 모임에 초대합니다!',
          url: url,
        });
      } catch (err) {
        // User cancelled or error - fallback to copy
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className={`w-full flex items-center gap-2 ${className}`}>
      <div className="flex-1 flex items-center bg-gray-50 dark:bg-gray-700/60 rounded-xl px-3 py-2 border border-gray-200 dark:border-gray-600 min-w-0">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <span className="text-xs text-gray-600 dark:text-gray-300 truncate flex-1 font-mono">
          {url}
        </span>
        <button 
          onClick={handleCopy}
          className={`ml-2 px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex-shrink-0 ${
            copied 
              ? 'bg-green-500 text-white shadow-sm' 
              : 'bg-primary-500 hover:bg-primary-600 text-white shadow-sm'
          }`}
          title="링크 복사"
        >
          {copied ? '복사됨!' : '복사'}
        </button>
      </div>

      {/* Mobile Web Share Button */}
      <button
        onClick={handleShare}
        className="md:hidden p-2 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-100 rounded-xl transition-colors flex-shrink-0"
        aria-label="공유하기"
        title="공유하기"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
      </button>
    </div>
  );
};

export default ShareLink;
