import { useRoomContext } from '../../contexts/RoomContext';
import { useSocketContext } from '../../contexts/SocketContext';
import { useClock } from '../../hooks/usePageVisibility';
import { isFreshLocation } from '../../utils/locationUtils';

export default function LocationToggle() {
  const { wantsSharing, toggleSharing, myLocation, locationStatus, locationError, retryLocation, visible, isRoomReady, serverSharing } = useRoomContext();
  const { isConnected } = useSocketContext();
  const now = useClock();
  const labels = { idle: '위치 공유 꺼짐', requesting: '위치 확인 중', live: '위치 공유 중',
    denied: '위치 권한 필요', unavailable: '위치 확인 불가', timeout: '위치 확인 지연',
    unsupported: '위치 공유 미지원', insecure: '안전한 연결 필요' };
  const fresh = isFreshLocation(myLocation, now);
  const label = !wantsSharing ? '위치 공유 꺼짐' : !isConnected || !isRoomReady ? '다시 연결하는 중' :
    !visible ? '화면 복귀 후 다시 공유' : locationStatus === 'live' && !fresh ? '위치 갱신 지연' : labels[locationStatus];
  const live = wantsSharing && isConnected && isRoomReady && visible && locationStatus === 'live' && fresh;
  return <div className="location-status">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0" role="status" aria-live="polite">
        <span className={'h-2.5 w-2.5 rounded-full shrink-0 ' + (live ? 'bg-green-500' : wantsSharing ? 'bg-amber-500' : 'bg-gray-400')} />
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <button type="button" role="switch" aria-checked={wantsSharing} aria-label="위치 공유"
        className="touch-button shrink-0" onClick={() => void toggleSharing(!wantsSharing)}>
        <span className={'inline-flex w-12 h-7 rounded-full items-center px-1 transition-colors ' + (wantsSharing ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600')}>
          <span className={'w-5 h-5 bg-white rounded-full transition-transform ' + (wantsSharing ? 'translate-x-5' : '')} />
        </span>
      </button>
    </div>
    {locationError && wantsSharing && <div className="mt-2 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
      <p>{locationError}</p>
      <button type="button" className="touch-button mt-1 text-primary-600 dark:text-primary-300 font-semibold" onClick={retryLocation}>위치 다시 확인</button>
    </div>}
    {!wantsSharing && <p className="text-xs text-gray-500 dark:text-gray-400">켜면 이 모임의 참여자에게 내 위치가 공유됩니다.</p>}
    {!wantsSharing && !isConnected && <p className="text-xs text-amber-700 mt-1">이 기기의 전송은 중지됐습니다. 다시 연결하면 모임 지도에서도 숨깁니다.</p>}
    {!wantsSharing && isConnected && serverSharing && <div className="text-xs text-amber-700 mt-1">
      <p>이 기기의 전송은 중지됐습니다. 모임 지도에서 숨기는 중입니다.</p>
      <button type="button" className="touch-button" onClick={() => void toggleSharing(false)}>위치 숨기기 다시 시도</button>
    </div>}
  </div>;
}
