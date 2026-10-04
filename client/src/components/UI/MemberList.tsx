import { useRoomContext } from '../../contexts/RoomContext';
import { useClock } from '../../hooks/usePageVisibility';
import { calculateDistance, directionsUrl, formatDistance, formatLocationAge, isMemberLocationFresh } from '../../utils/locationUtils';

export default function MemberList({ compact = false }: { compact?: boolean }) {
  const { members, userId, myLocation, panToLocation } = useRoomContext();
  const now = useClock();
  if (compact) return <div className="flex gap-3 overflow-x-auto pb-1" aria-label="참여자 빠른 보기">
    {members.map(member => <button type="button" key={member.id}
      className="flex flex-col items-center min-w-14 shrink-0 rounded-xl p-1 min-h-16"
      disabled={!member.isSharing || !member.location}
      onClick={() => member.location && panToLocation(member.location)}
      aria-label={member.nickname + (member.id === userId ? ' (나)' : '') + ' 위치 보기'}>
      <img src={member.photoBase64} alt="" className={'w-10 h-10 rounded-full object-cover border-2 ' + ((member.isOnline || member.backgroundSharing) && member.isSharing && isMemberLocationFresh(member, now) ? 'border-primary-500' : 'border-gray-300 grayscale')} />
      <span className="text-xs mt-1 max-w-16 truncate">{member.nickname}{member.id === userId ? ' (나)' : ''}</span>
    </button>)}
  </div>;
  return <ul className="space-y-2" aria-label="참여자 목록">
    {members.map(member => {
      const online = member.isOnline && now - member.lastSeenAt < 60_000;
      const fresh = isMemberLocationFresh(member, now);
      const present = online || (member.backgroundSharing && fresh);
      const distance = myLocation && member.location && member.id !== userId ? formatDistance(calculateDistance(myLocation, member.location)) : null;
      const detail = !member.isSharing ? '위치 공유 꺼짐' : !member.location ? '아직 위치를 확인하지 못했어요' : formatLocationAge(member.location.timestamp, now);
      return <li key={member.id} className="rounded-xl border border-gray-100 dark:border-gray-700 p-3">
        <button type="button" className="w-full flex items-center gap-3 text-left min-h-12 rounded-lg"
          disabled={!member.isSharing || !member.location} onClick={() => member.location && panToLocation(member.location)}
          aria-label={member.nickname + ' 지도에서 보기'}>
          <img src={member.photoBase64} alt="" className={'w-11 h-11 rounded-full object-cover shrink-0 ' + (!present || !fresh ? 'grayscale' : '')} />
          <span className="min-w-0 flex-1">
            <span className="font-semibold block truncate">{member.nickname}{member.id === userId ? ' (나)' : ''}</span>
            <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">{detail}{distance ? ' · 약 ' + distance : ''}</span>
            {member.location?.accuracy !== undefined && member.isSharing && <span className="text-xs text-gray-500 dark:text-gray-400">정확도 약 ±{Math.round(member.location.accuracy)}m</span>}
          </span>
          <span className={'text-xs shrink-0 ' + (!present || !fresh ? 'text-amber-600 dark:text-amber-300' : 'text-primary-600 dark:text-primary-300')}>
            {!member.isSharing ? '꺼짐' : member.backgroundSharing ? fresh ? '백그라운드 공유' : '다음 위치 대기' : !online ? '연결 끊김' : fresh ? '공유 중' : '갱신 대기'}
          </span>
        </button>
        {member.location && member.isSharing && member.id !== userId && <a href={directionsUrl(member.location)} target="_blank" rel="noopener noreferrer"
          className="touch-button mt-2 text-sm text-primary-600 dark:text-primary-300">이 위치까지 길찾기{!fresh ? ' (마지막 위치)' : ''}</a>}
      </li>;
    })}
  </ul>;
}
