import { useEffect, useRef, useState } from 'react';
import { AdvancedMarker, APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import { useRoomContext } from '../../contexts/RoomContext';
import UserMarker from './UserMarker';
import MapControls, { mapPadding } from './MapControls';
import { isFreshLocation, isMemberLocationFresh } from '../../utils/locationUtils';

function MapController() {
  const map = useMap();
  const { members, targetLocation, myLocation, isSharing } = useRoomContext();
  const initialized = useRef(false);
  useEffect(() => {
    if (!map || initialized.current) return;
    const positions = members.filter(member => member.isSharing && isMemberLocationFresh(member)).map(member => member.location!);
    if (!positions.length) return;
    const bounds = new google.maps.LatLngBounds();
    positions.forEach(position => bounds.extend(position));
    map.fitBounds(bounds, mapPadding(map));
    google.maps.event.addListenerOnce(map, 'idle', () => { if ((map.getZoom() ?? 15) > 17) map.setZoom(17); });
    initialized.current = true;
  }, [map, members]);
  useEffect(() => {
    if (!map || !targetLocation) return;
    map.panTo(targetLocation); map.setZoom(17);
    map.panBy(0, mapPadding(map).bottom / 2);
  }, [map, targetLocation]);
  useEffect(() => {
    if (!map || !isSharing || !isFreshLocation(myLocation) || !myLocation?.accuracy) return;
    const circle = new google.maps.Circle({
      map, center: myLocation, radius: Math.min(myLocation.accuracy, 5000),
      fillColor: '#3b82f6', fillOpacity: .1, strokeColor: '#3b82f6', strokeOpacity: .3,
      strokeWeight: 1, clickable: false,
    });
    return () => circle.setMap(null);
  }, [map, myLocation, isSharing]);
  return null;
}
export default function MapView() {
  const { members, myLocation, room, pickingPoint, chooseMeetingPoint, setPickingPoint } = useRoomContext();
  const [failed, setFailed] = useState(false);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  if (!apiKey || failed) return <div className="w-full h-full flex items-start justify-center bg-primary-50 dark:bg-gray-800 p-8">
    <p role="status" className="text-sm text-center text-gray-600 dark:text-gray-300 max-w-xs">지도를 불러오지 못했습니다. 참여자 목록에서 공유 상태와 마지막 위치를 확인할 수 있어요.</p>
  </div>;
  return <div className="w-full h-full relative">
    {pickingPoint && <div className="absolute top-3 inset-x-3 z-20 bg-white dark:bg-gray-800 rounded-xl p-3 shadow-md text-sm">
      <p>지도에서 ‘{pickingPoint}’ 위치를 터치해주세요.</p>
      <button className="touch-button text-primary-600" type="button" onClick={() => setPickingPoint(null)}>취소</button>
    </div>}
    <APIProvider apiKey={apiKey} onError={() => setFailed(true)}>
      <Map mapId={import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'}
        defaultCenter={myLocation ?? { lat: 37.5665, lng: 126.9780 }} defaultZoom={15}
        disableDefaultUI gestureHandling="greedy"
        onClick={event => { if (pickingPoint && event.detail.latLng) void chooseMeetingPoint({ ...event.detail.latLng, label: pickingPoint }); }}>
        {members.map(member => <UserMarker key={member.id} member={member} />)}
        {room?.meetingPoint && <AdvancedMarker position={room.meetingPoint} title={room.meetingPoint.label}>
          <span className="bg-primary-700 text-white px-3 py-2 rounded-xl font-semibold shadow-md">📍 {room.meetingPoint.label}</span>
        </AdvancedMarker>}
        <MapController /><MapControls />
      </Map>
    </APIProvider>
  </div>;
}
