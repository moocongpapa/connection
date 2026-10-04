import { Link, useParams } from 'react-router-dom';
import ProfileSetup from '../Profile/ProfileSetup';
import ThemeToggle from '../UI/ThemeToggle';
import { useRoomContext } from '../../contexts/RoomContext';
import { useSocketContext } from '../../contexts/SocketContext';

export default function JoinRoom() {
  const { roomId } = useParams();
  const { joinRoom, error, isJoining } = useRoomContext();
  const { isConnected, connectionError } = useSocketContext();
  return <main className="onboarding-page">
    <div className="w-full max-w-md mx-auto">
      <div className="flex items-center justify-between mb-5"><Link className="touch-button text-sm" to="/">← 처음으로</Link><ThemeToggle /></div>
      <h1 className="text-2xl font-bold text-center">모임 참여하기</h1>
      <p className="text-center text-sm text-gray-500 mt-2 mb-5">닉네임으로 참여하세요. 사진은 선택 사항입니다.</p>
      <ProfileSetup onSubmit={profile => roomId && void joinRoom(roomId, profile)} buttonText="참여하기" pending={isJoining} connected={isConnected} />
      {(error || connectionError) && <p role="alert" className="text-red-600 dark:text-red-300 text-sm mt-4">{error || connectionError}</p>}
      <p className="text-xs text-gray-500 mt-4 leading-relaxed">참여 후 위치 공유를 직접 켤 수 있습니다. 위치가 확인되지 않으면 Safari 또는 Chrome으로 열어주세요.</p>
    </div>
  </main>;
}
