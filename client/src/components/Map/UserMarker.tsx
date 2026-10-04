import { AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import type { Member } from '../../types';
import { useClock } from '../../hooks/usePageVisibility';
import { formatLocationAge, isFreshLocation } from '../../utils/locationUtils';

export default function UserMarker({ member }: { member: Member }) {
  const map = useMap();
  const now = useClock();
  if (!member.isSharing || !member.location) return null;
  const fresh = member.isOnline && isFreshLocation(member.location, now);
  return <AdvancedMarker position={{ lat: member.location.lat, lng: member.location.lng }}
    onClick={() => { map?.panTo(member.location!); map?.setZoom(17); }} zIndex={fresh ? 10 : 1}
    title={member.nickname + ' · ' + formatLocationAge(member.location.timestamp, now)}>
    <div className={'marker-container flex flex-col items-center ' + (fresh ? '' : 'opacity-65')}>
      <img src={member.photoBase64} alt={member.nickname} className={'w-12 h-12 rounded-full object-cover border-3 shadow-md ' + (fresh ? 'border-primary-500' : 'border-gray-400 grayscale')} />
      <span className="bg-white text-gray-900 rounded-md px-2 py-1 text-xs shadow-md mt-1">{member.nickname}</span>
      {!fresh && <span className="bg-amber-50 text-amber-900 rounded px-1 text-[11px]">마지막 위치</span>}
    </div>
  </AdvancedMarker>;
}
