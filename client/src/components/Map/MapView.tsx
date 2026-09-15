import React, { useEffect, useRef } from 'react';
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import { useRoomContext } from '../../contexts/RoomContext';
import UserMarker from './UserMarker';
import MapControls from './MapControls';

const MapBoundsUpdater: React.FC = () => {
  const map = useMap();
  const { members } = useRoomContext();
  const hasInitializedBounds = useRef(false);

  useEffect(() => {
    // Only auto-fit bounds on initial load with members
    if (!map || members.length === 0 || hasInitializedBounds.current) return;

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
      hasInitializedBounds.current = true;
    }
  }, [map, members]);

  return null;
};

const MapPanController: React.FC = () => {
  const map = useMap();
  const { targetLocation } = useRoomContext();

  useEffect(() => {
    if (!map || !targetLocation) return;
    map.panTo({ lat: targetLocation.lat, lng: targetLocation.lng });
    map.setZoom(17);
  }, [map, targetLocation]);

  return null;
};

const MapView: React.FC = () => {
  const { members, myLocation } = useRoomContext();
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

  const defaultCenter = myLocation 
    ? { lat: myLocation.lat, lng: myLocation.lng }
    : { lat: 37.5665, lng: 126.9780 }; // Seoul

  return (
    <div className="w-full h-full relative">
      <APIProvider apiKey={apiKey}>
        <Map
          mapId={mapId}
          defaultCenter={defaultCenter}
          defaultZoom={15}
          disableDefaultUI={true}
          gestureHandling="greedy"
        >
          {members.map(member => (
            <UserMarker key={member.id} member={member} />
          ))}
          <MapBoundsUpdater />
          <MapPanController />
          <MapControls />
        </Map>
      </APIProvider>
    </div>
  );
};

export default MapView;
