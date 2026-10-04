import { useNavigate } from 'react-router-dom';
import { useRoomContext } from '../../contexts/RoomContext';
import { useSocketContext } from '../../contexts/SocketContext';
import ShareLink from '../UI/ShareLink';
import ThemeToggle from '../UI/ThemeToggle';

export default function RoomHeader({ isMobile = false }: { isMobile?: boolean }) {
  const { room, members, leaveRoom, isRoomReady, error } = useRoomContext();
  const { isConnected } = useSocketContext();
  const navigate = useNavigate();
  if (!room) return null;
  const connected = isConnected && isRoomReady;
  const leave = async () => {
    if (!window.confirm('모임에서 나가면 내 위치 공유도 중단됩니다. 나가시겠습니까?')) return;
    try { await leaveRoom(); } catch { /* Local sharing and membership have already been cleared. */ }
    finally { navigate('/'); }
  };
  return <header className={'room-header ' + (isMobile ? 'safe-top' : '')}>
    <div className="flex items-center justify-between gap-2 min-w-0 mb-2">
      <div className="min-w-0">
        <h1 className="font-bold text-base truncate">Connection <span className="font-normal text-xs text-gray-500">{members.length}명</span></h1>
        <p className={'text-xs ' + (connected ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-300')} role="status">{connected ? '모임 연결됨' : '자동으로 다시 연결하는 중'}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0"><ThemeToggle />
        <button type="button" className="touch-button text-sm text-gray-500" aria-label="모임 나가기" onClick={() => void leave()}>나가기</button>
      </div>
    </div>
    <ShareLink />
    {error && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-300">{error}</p>}
  </header>;
}
