import React, { useState, useRef, useEffect } from 'react';
import { compressImage } from '../../utils/imageUtils';
import { ProfileData } from '../../types';

interface ProfileSetupProps {
  onSubmit: (profile: ProfileData) => void;
  buttonText: string;
}

const ProfileSetup: React.FC<ProfileSetupProps> = ({ onSubmit, buttonText }) => {
  const [nickname, setNickname] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load previously saved profile if available
  useEffect(() => {
    try {
      const savedProfileStr = localStorage.getItem('connection_profile');
      if (savedProfileStr) {
        const saved = JSON.parse(savedProfileStr);
        if (saved.nickname) setNickname(saved.nickname);
        if (saved.photoBase64) setPhotoUrl(saved.photoBase64);
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      const compressed = await compressImage(file, 200, 0.7);
      setPhotoUrl(compressed);
    } catch (error) {
      console.error('Failed to compress image:', error);
      alert('이미지 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      alert('닉네임을 입력해주세요.');
      return;
    }
    
    // Default avatar if no photo
    const defaultPhoto = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjdWEzZSI+PHBhdGggZD0iTTEyIDJhNSA1IDAgMTA1IDUgNSA1IDAgMDAtNS01em0wIDhjLTIuNjcgMC04IDEuMzQtOCA0djJoMTZ2LTJjMC0yLjY2LTUuMzMtNC04LTR6Ii8+PC9zdmc+';

    const profileData: ProfileData = {
      nickname: nickname.trim(),
      photoBase64: photoUrl || defaultPhoto
    };

    // Save to localStorage
    localStorage.setItem('connection_profile', JSON.stringify(profileData));

    onSubmit(profileData);
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
      <h2 className="text-2xl font-bold text-center mb-8 text-gray-800 dark:text-white">프로필 설정</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-col items-center">
          <div 
            className="w-32 h-32 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center cursor-pointer overflow-hidden border-4 border-primary-100 dark:border-gray-600 relative group shadow-inner"
            onClick={() => fileInputRef.current?.click()}
          >
            {photoUrl ? (
              <img src={photoUrl} alt="Profile preview" className="w-full h-full object-cover" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            )}
            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-white text-[11px] mt-1 font-medium">사진 변경</span>
            </div>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">사진을 터치하여 변경하세요</p>
        </div>

        <div>
          <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            닉네임
          </label>
          <input
            type="text"
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, 20))}
            className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white transition-colors text-sm"
            placeholder="닉네임을 입력하세요 (최대 20자)"
            maxLength={20}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !nickname.trim()}
          className="w-full py-3.5 px-4 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-base"
        >
          {isLoading ? '처리 중...' : buttonText}
        </button>
      </form>
    </div>
  );
};

export default ProfileSetup;
