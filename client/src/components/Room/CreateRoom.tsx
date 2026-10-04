import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ProfileSetup from '../Profile/ProfileSetup';
import ThemeToggle from '../UI/ThemeToggle';
import PwaInstall from '../UI/PwaInstall';
import { useRoomContext } from '../../contexts/RoomContext';
import { useSocketContext } from '../../contexts/SocketContext';
import { getRecentRooms } from '../../utils/storage';
import type { ProfileData } from '../../types';

export default function CreateRoom() {
  const [step, setStep] = useState<'intro' | 'profile'>('intro');
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const navigate = useNavigate();
  const { createRoom, isJoining, room } = useRoomContext();
  const { isConnected } = useSocketContext();
  const recent = getRecentRooms().filter(item => Date.now() - item.visitedAt < 86400000);
  const submit = async (profile: ProfileData) => {
    if (submitting.current) return;
    submitting.current = true; setError(null);
    try { navigate('/room/' + await createRoom(profile)); }
    catch (problem) { setError((problem as Error).message); }
    finally { submitting.current = false; }
  };
  return <main className="onboarding-page">
    <div className="max-w-md w-full mx-auto">
      <div className="flex justify-end mb-4"><ThemeToggle /></div>
      {step === 'intro' ? <div className="space-y-6">
        <div className="text-center"><img src="/icon.svg" alt="" className="w-20 h-20 mx-auto mb-5" />
          <h1 className="text-4xl font-bold">Connection</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-4 leading-relaxed">함께 만날 때, 서로의 위치를 확인하세요.<br />모임을 만들고 초대 링크를 보내면 시작됩니다.</p>
        </div>
        <button type="button" className="primary-button w-full" onClick={() => setStep('profile')}>모임 만들기</button>
        {room && <Link className="secondary-button w-full" to={'/room/' + room.id}>현재 모임으로 돌아가기</Link>}
        {recent.length > 0 && <div><h2 className="font-semibold mb-2">최근 모임</h2>
          <ul className="space-y-2">{recent.map(item => <li key={item.id}><Link className="secondary-button w-full justify-between" to={'/room/' + item.id}>
            <span>모임 다시 열기</span><span className="text-xs text-gray-500">{new Date(item.visitedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </Link></li>)}</ul>
        </div>}
        <PwaInstall />
        <p className="text-xs text-gray-500 leading-relaxed text-center">내 위치는 공유를 켠 뒤에만 참여자에게 전달됩니다.<br />화면 잠금이나 앱 전환 중에는 위치 갱신이 멈출 수 있어요.</p>
      </div> : <>
        <button type="button" className="touch-button mb-2 text-sm" onClick={() => setStep('intro')}>← 처음으로</button>
        <ProfileSetup onSubmit={profile => void submit(profile)} buttonText="모임 시작하기" pending={isJoining} connected={isConnected} />
        {error && <p role="alert" className="text-red-600 mt-3">{error}</p>}
      </>}
    </div>
  </main>;
}
