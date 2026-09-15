import React from 'react';
import { useRoomContext } from '../../contexts/RoomContext';
import ShareLink from '../UI/ShareLink';
import ThemeToggle from '../UI/ThemeToggle';
import { useNavigate } from 'react-router-dom';

interface RoomHeaderProps {
  isMobile?: boolean;
}

const RoomHeader: React.FC<RoomHeaderProps> = ({ isMobile = false }) => {
  const { room, members, leaveRoom } = useRoomContext();
  const navigate = useNavigate();

  if (!room) return null;

  const handleLeave = () => {
    if (window.confirm('모임에서 나가시겠습니까?')) {
      // Clear saved room flag on intentional leave
      localStorage.removeItem('connection_active_room');
      leaveRoom();
      navigate('/');
    }
  };

  if (isMobile) {
    return (
      <div className="glass mx-3 mt-3 rounded-2xl p-3 flex flex-col gap-2 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse flex-shrink-0"></span>
            <h2 className="text-base font-bold text-gray-900 dark:text-white truncate">
              Connection 모임
            </h2>
            <span className="text-xs bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-semibold px-2 py-0.5 rounded-full">
              {members.length}명
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <button 
              onClick={handleLeave}
              className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
              title="모임 나가기"
              aria-label="나가기"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        <ShareLink />
      </div>
    );
  }

  // Desktop View
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse flex-shrink-0"></span>
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white truncate">
              Connection 모임
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              참여 인원: <span className="font-semibold text-primary-500">{members.length}명</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <button 
            onClick={handleLeave}
            className="px-2.5 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 rounded-lg transition-colors flex items-center gap-1"
            title="모임 나가기"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>나가기</span>
          </button>
        </div>
      </div>

      {/* Full width share link */}
      <ShareLink />
    </div>
  );
};

export default RoomHeader;
