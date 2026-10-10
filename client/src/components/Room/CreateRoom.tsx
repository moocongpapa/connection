import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import ProfileSetup from '../Profile/ProfileSetup';
import ThemeToggle from '../UI/ThemeToggle';
import PwaInstall from '../UI/PwaInstall';
import InAppNotice from '../UI/InAppNotice';
import { useRoomContext } from '../../contexts/RoomContext';
import { useSocketContext } from '../../contexts/SocketContext';
import { getRecentRooms } from '../../utils/storage';
import { extractRoomId } from '../../utils/browserUtils';
import type { ProfileData } from '../../types';

export default function CreateRoom() {
  const [searchParams] = useSearchParams();
  const initialStep = searchParams.get('action') === 'join' ? 'join' : 'intro';
  const [step, setStep] = useState<'intro' | 'profile' | 'join'>(initialStep);
  const [error, setError] = useState<string | null>(null);
  const [joinInput, setJoinInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const submitting = useRef(false);
  const navigate = useNavigate();
  const { createRoom, isJoining, room, isNative } = useRoomContext();
  const { isConnected } = useSocketContext();
  const recent = getRecentRooms().filter(item => Date.now() - item.visitedAt < 86400000);

  const submit = async (profile: ProfileData) => {
    if (submitting.current) return;
    submitting.current = true; setError(null);
    try { navigate('/room/' + await createRoom(profile)); }
    catch (problem) { setError((problem as Error).message); }
    finally { submitting.current = false; }
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    const roomId = extractRoomId(joinInput);
    if (!roomId) {
      setJoinError('올바른 초대 링크 또는 모임 코드를 입력해주세요.');
      return;
    }
    navigate('/room/' + roomId);
  };

  const handlePasteClipboard = async () => {
    setJoinError(null);
    try {
      if (!navigator.clipboard?.readText) {
        setJoinError('클립보드 읽기를 지원하지 않는 환경입니다. 직접 붙여넣어 주세요.');
        return;
      }
      const text = await navigator.clipboard.readText();
      if (!text) {
        setJoinError('클립보드가 비어있습니다.');
        return;
      }
      setJoinInput(text.trim());
      const extracted = extractRoomId(text);
      if (extracted) {
        // Automatically populated valid code
        setJoinError(null);
      }
    } catch {
      setJoinError('클립보드 접근 권한이 없거나 지원되지 않습니다. 직접 입력해주세요.');
    }
  };

  return <main className="onboarding-page">
    <div className="max-w-md w-full mx-auto">
      <div className="flex justify-end mb-4"><ThemeToggle /></div>
      <InAppNotice />
      {step === 'intro' ? <div className="space-y-6">
        <div className="text-center"><img src="/icon.svg" alt="" className="w-20 h-20 mx-auto mb-5" />
          <h1 className="text-4xl font-bold">Connection</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-4 leading-relaxed">함께 만날 때, 서로의 위치를 확인하세요.<br />모임을 만들고 초대 링크를 보내면 시작됩니다.</p>
        </div>
        <div className="space-y-3">
          <button type="button" className="primary-button w-full" onClick={() => setStep('profile')}>새 모임 만들기</button>
          <button type="button" className="secondary-button w-full" onClick={() => { setStep('join'); setJoinError(null); }}>초대 코드로 참여하기</button>
        </div>
        {room && <Link className="secondary-button w-full" to={'/room/' + room.id}>현재 모임으로 돌아가기</Link>}
        {recent.length > 0 && <div><h2 className="font-semibold mb-2">최근 모임</h2>
          <ul className="space-y-2">{recent.map(item => <li key={item.id}><Link className="secondary-button w-full justify-between" to={'/room/' + item.id}>
            <span>모임 다시 열기</span><span className="text-xs text-gray-500">{new Date(item.visitedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </Link></li>)}</ul>
        </div>}
        {!isNative && <PwaInstall />}
        <p className="text-xs text-gray-500 leading-relaxed text-center">내 위치는 공유를 켠 뒤에만 참여자에게 전달됩니다.<br />{isNative ? '공유 중에는 화면을 꺼도 위치를 전송합니다. 최대 8시간 뒤 자동 종료됩니다.' : '화면 잠금이나 앱 전환 중에는 위치 갱신이 멈출 수 있어요.'}</p>
      </div> : step === 'join' ? <div>
        <button type="button" className="touch-button mb-3 text-sm" onClick={() => setStep('intro')}>← 처음으로</button>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-center mb-2">초대 코드로 참여</h2>
          <p className="text-sm text-gray-500 text-center mb-5">공유받은 초대 링크나 모임 코드를 입력해주세요.</p>
          <form onSubmit={handleJoinSubmit} className="space-y-4">
            <div>
              <label htmlFor="join-input" className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">
                초대 링크 또는 모임 코드
              </label>
              <div className="relative">
                <input
                  id="join-input"
                  type="text"
                  value={joinInput}
                  onChange={e => { setJoinInput(e.target.value); setJoinError(null); }}
                  placeholder="예: https://.../room/abc-123 또는 abc-123"
                  className="form-input w-full pr-24"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => void handlePasteClipboard()}
                  className="absolute right-1.5 top-1.5 bottom-1.5 px-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-medium rounded-lg transition-colors"
                >
                  붙여넣기
                </button>
              </div>
            </div>
            {joinError && <p role="alert" className="text-red-600 dark:text-red-400 text-xs">{joinError}</p>}
            <button type="submit" className="primary-button w-full">모임 참여하기</button>
          </form>
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 leading-relaxed">
            <p>💡 카카오톡 등에서 받은 링크 전체를 복사해서 붙여넣으셔도 자동으로 인식됩니다.</p>
          </div>
        </div>
      </div> : <>
        <button type="button" className="touch-button mb-2 text-sm" onClick={() => setStep('intro')}>← 처음으로</button>
        <ProfileSetup onSubmit={profile => void submit(profile)} buttonText="모임 시작하기" pending={isJoining} connected={isConnected} />
        {error && <p role="alert" className="text-red-600 mt-3">{error}</p>}
      </>}
    </div>
  </main>;
}
