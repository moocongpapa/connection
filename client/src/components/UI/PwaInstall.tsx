import { useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { useRoomContext } from '../../contexts/RoomContext';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
const refreshListeners = new Set<() => void>();
let needsRefresh = false;
const updateApp = registerSW({
  onNeedRefresh: () => { needsRefresh = true; refreshListeners.forEach(listener => listener()); },
});
export default function PwaInstall() {
  const prompt = useRef<InstallPrompt | null>(null);
  const [available, setAvailable] = useState(false);
  const [refresh, setRefresh] = useState(needsRefresh);
  const { wantsSharing } = useRoomContext();
  useEffect(() => {
    const capture = (event: Event) => { event.preventDefault(); prompt.current = event as InstallPrompt; setAvailable(true); };
    const installed = () => { prompt.current = null; setAvailable(false); };
    const changed = () => setRefresh(true);
    window.addEventListener('beforeinstallprompt', capture); window.addEventListener('appinstalled', installed);
    refreshListeners.add(changed);
    return () => {
      window.removeEventListener('beforeinstallprompt', capture); window.removeEventListener('appinstalled', installed);
      refreshListeners.delete(changed);
    };
  }, []);
  const install = async () => {
    if (!prompt.current) return;
    await prompt.current.prompt(); await prompt.current.userChoice;
    prompt.current = null; setAvailable(false);
  };
  return <div className="rounded-2xl border border-primary-100 dark:border-gray-700 p-4 bg-white/60 dark:bg-gray-800">
    <p className="font-semibold text-sm">홈 화면에서 바로 열기</p>
    {available ? <button className="secondary-button mt-2" type="button" onClick={() => void install()}>홈 화면에 추가</button>
      : <p className="text-xs text-gray-500 leading-relaxed mt-2">iPhone: Safari의 공유 메뉴 → 홈 화면에 추가<br />Android: Chrome 메뉴 → 앱 설치 또는 홈 화면에 추가</p>}
    <p className="text-xs text-gray-500 mt-2">설치 후에도 위치 공유에는 인터넷과 위치 권한이 필요합니다.</p>
    {refresh && <button className="secondary-button mt-3" type="button" disabled={wantsSharing} onClick={() => void updateApp(true)}>
      {wantsSharing ? '위치 공유를 끈 뒤 업데이트' : '새 버전으로 업데이트'}
    </button>}
  </div>;
}
