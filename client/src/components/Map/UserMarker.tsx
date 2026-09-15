import React from 'react';
import { AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { Member } from '../../types';

interface UserMarkerProps {
  member: Member;
}

const UserMarker: React.FC<UserMarkerProps> = ({ member }) => {
  const map = useMap();
  
  if (!member.location) return null;

  const position = { lat: member.location.lat, lng: member.location.lng };

  const handleClick = () => {
    if (map && member.location) {
      map.panTo(position);
      map.setZoom(17);
    }
  };

  return (
    <AdvancedMarker position={position} onClick={handleClick} zIndex={member.isSharing ? 10 : 1}>
      <div className={`marker-container flex flex-col items-center ${!member.isSharing ? 'marker-hidden' : ''}`}>
        <div className={`relative rounded-full border-3 border-primary-500 shadow-lg ${member.isSharing ? 'marker-sharing' : ''}`}>
          <img 
            src={member.photoBase64} 
            alt={member.nickname} 
            className="w-12 h-12 rounded-full object-cover bg-white"
          />
          {!member.isSharing && (
            <div className="absolute -top-2 -right-2 bg-gray-800 text-white text-[10px] px-2 py-0.5 rounded-full border border-gray-600 whitespace-nowrap">
              위치 숨김
            </div>
          )}
        </div>
        <div className="mt-1 bg-white dark:bg-gray-800 px-2 py-1 rounded-full shadow-md text-xs font-semibold text-gray-800 dark:text-white border border-gray-100 dark:border-gray-700">
          {member.nickname}
        </div>
      </div>
    </AdvancedMarker>
  );
};

export default UserMarker;
