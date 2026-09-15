import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ProfileSetup from '../Profile/ProfileSetup';
import { useRoomContext } from '../../contexts/RoomContext';
import { ProfileData } from '../../types';
import ThemeToggle from '../UI/ThemeToggle';

const JoinRoom: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { joinRoom, room, error: roomError } = useRoomContext();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (room && room.id === roomId) {
      // Already in room, could happen if user navigated back
      navigate(`/room/${roomId}`);
    }
  }, [room, roomId, navigate]);

  const handleProfileSubmit = (profile: ProfileData) => {
    if (!roomId) {
      setError('유효하지 않은 링크입니다.');
      return;
    }
    joinRoom(roomId, profile);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 flex flex-col">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="mb-6 text-center">
          <div className="w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">모임 참여하기</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">초대받은 모임에 입장하려면 프로필을 설정해주세요.</p>
        </div>

        <div className="w-full">
          <ProfileSetup onSubmit={handleProfileSubmit} buttonText="참여하기" />
          
          {(error || roomError) && (
            <p className="text-red-500 text-center mt-4 bg-red-100 dark:bg-red-900/30 p-3 rounded-lg max-w-md mx-auto">
              {error || roomError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default JoinRoom;
