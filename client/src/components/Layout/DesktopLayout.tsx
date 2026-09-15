import React from 'react';
import MapView from '../Map/MapView';
import RoomHeader from '../Room/RoomHeader';
import MemberList from '../UI/MemberList';
import LocationToggle from '../UI/LocationToggle';

const DesktopLayout: React.FC = () => {
  return (
    <div className="w-full h-screen flex overflow-hidden bg-gray-100 dark:bg-gray-900">
      {/* Left 70% Map View */}
      <div className="flex-1 relative z-0">
        <MapView />
      </div>
      
      {/* Right Sidebar 360px */}
      <div className="w-[360px] h-full bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col z-10 shadow-xl">
        <div className="p-4 flex flex-col h-full gap-3">
          <RoomHeader isMobile={false} />
          <LocationToggle />
          <div className="flex-1 min-h-0 flex flex-col">
            <MemberList isMobile={false} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesktopLayout;
