import React from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { useRoomContext } from '../../contexts/RoomContext';

const MapControls: React.FC = () => {
  const map = useMap();
  const { myLocation, members } = useRoomContext();

  const handleCenterMyLocation = () => {
    if (map && myLocation) {
      map.panTo({ lat: myLocation.lat, lng: myLocation.lng });
      map.setZoom(17);
    }
  };

  const handleFitAll = () => {
    if (!map || members.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    let hasLocation = false;

    members.forEach(member => {
      if (member.location && member.isSharing) {
        bounds.extend({ lat: member.location.lat, lng: member.location.lng });
        hasLocation = true;
      }
    });

    if (hasLocation) {
      map.fitBounds(bounds, 50);
    }
  };

  return (
    <div className="absolute bottom-[180px] right-4 md:bottom-8 md:right-8 flex flex-col gap-3 z-10">
      <button 
        onClick={handleFitAll}
        className="w-12 h-12 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        aria-label="전체 보기"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </button>
      <button 
        onClick={handleCenterMyLocation}
        className="w-12 h-12 bg-primary-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-primary-600 transition-colors"
        aria-label="내 위치"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </div>
  );
};

export default MapControls;
