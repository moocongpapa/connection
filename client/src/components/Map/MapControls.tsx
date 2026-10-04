import { useMap } from '@vis.gl/react-google-maps';
import { useRoomContext } from '../../contexts/RoomContext';

export function mapPadding(map: google.maps.Map) {
  const container = map.getDiv();
  const panel = container.closest('[data-map-area]')?.querySelector('[data-mobile-panel]');
  return { top: 24, left: 24, right: 24, bottom: Math.min((panel?.getBoundingClientRect().height ?? 0) + 24, container.clientHeight * .72) };
}
export default function MapControls() {
  const map = useMap();
  const { myLocation, members, room } = useRoomContext();
  const fitAll = () => {
    if (!map) return;
    const bounds = new google.maps.LatLngBounds();
    for (const member of members) if (member.isSharing && member.location) bounds.extend(member.location);
    if (room?.meetingPoint) bounds.extend(room.meetingPoint);
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, mapPadding(map));
      google.maps.event.addListenerOnce(map, 'idle', () => { if ((map.getZoom() ?? 15) > 17) map.setZoom(17); });
    }
  };
  return <div className="map-controls">
    <button type="button" className="touch-button bg-white dark:bg-gray-800 shadow-lg text-sm font-semibold" aria-label="전체 보기" onClick={fitAll}>전체</button>
    <button type="button" className="touch-button bg-primary-600 text-white shadow-lg text-sm font-semibold" aria-label="내 위치" disabled={!myLocation}
      onClick={() => { if (map && myLocation) { map.panTo(myLocation); map.setZoom(17); map.panBy(0, mapPadding(map).bottom / 2); } }}>내 위치</button>
  </div>;
}
