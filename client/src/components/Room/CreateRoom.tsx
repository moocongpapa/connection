import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProfileSetup from '../Profile/ProfileSetup';
import { useRoomContext } from '../../contexts/RoomContext';
import { ProfileData } from '../../types';
import ThemeToggle from '../UI/ThemeToggle';

const CreateRoom: React.FC = () => {
  const [step, setStep] = useState<'intro' | 'profile'>('intro');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { createRoom } = useRoomContext();

  const handleProfileSubmit = async (profile: ProfileData) => {
    try {
      const roomId = await createRoom(profile);
      navigate(`/room/${roomId}`);
    } catch (err) {
      setError(err as string);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 flex flex-col">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {step === 'intro' ? (
          <div className="text-center max-w-lg">
            <div className="mb-8 flex justify-center">
              <div className="w-24 h-24 bg-primary-500 rounded-full flex items-center justify-center shadow-xl">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight">
              Connection
            </h1>
            <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-10">
              친구들과 실시간으로 위치를 공유하세요.<br />
              모임을 만들고 링크만 보내면 끝!
            </p>
            
            <button
              onClick={() => setStep('profile')}
              className="w-full sm:w-auto px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-full text-lg font-bold shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
            >
              모임 만들기
            </button>
          </div>
        ) : (
          <div className="w-full">
            <ProfileSetup onSubmit={handleProfileSubmit} buttonText="모임 시작하기" />
            {error && (
              <p className="text-red-500 text-center mt-4">{error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateRoom;
