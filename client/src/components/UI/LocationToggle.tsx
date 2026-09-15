import React, { useState } from 'react';
import { useRoomContext } from '../../contexts/RoomContext';

const LocationToggle: React.FC = () => {
  const { toggleSharing, startTracking, stopTracking } = useRoomContext();
  const [isSharing, setIsSharing] = useState(true); // Default ON when joining

  const handleToggle = () => {
    const newValue = !isSharing;
    setIsSharing(newValue);
    toggleSharing(newValue);
    
    if (newValue) {
      startTracking();
    } else {
      stopTracking();
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-full shadow-lg px-4 py-3 flex items-center justify-between gap-4 border border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${isSharing ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-gray-400'}`}></div>
        <span className="text-sm font-bold text-gray-800 dark:text-white">
          {isSharing ? '위치 공유 중' : '위치 숨김'}
        </span>
      </div>
      
      <button 
        onClick={handleToggle}
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none ${isSharing ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'}`}
      >
        <span 
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${isSharing ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>
    </div>
  );
};

export default LocationToggle;
