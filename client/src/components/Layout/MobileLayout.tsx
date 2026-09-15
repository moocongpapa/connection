import React from 'react';
import MapView from '../Map/MapView';
import RoomHeader from '../Room/RoomHeader';
import MemberList from '../UI/MemberList';
import LocationToggle from '../UI/LocationToggle';

const MobileLayout: React.FC = () => {
  return (
    <div className="w-full h-[100dvh] flex flex-col relative overflow-hidden bg-gray-100 dark:bg-gray-900">
      {/* Top Header Overlay */}
      <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
        <div className="pointer-events-auto">
          <RoomHeader isMobile={true} />
        </div>
      </div>
      
      {/* Full-screen Map */}
      <div className="flex-1 w-full h-full relative z-0">
        <MapView />
      </div>
      
      {/* Floating Location Toggle (positioned above bottom sheet) */}
      <div className="absolute bottom-[108px] left-1/2 transform -translate-x-1/2 z-30 w-[90%] max-w-sm pointer-events-auto shadow-lg">
        <LocationToggle />
      </div>
      
      {/* Bottom Sheet Member List */}
      <MemberList isMobile={true} />
    </div>
  );
};

export default MobileLayout;
