import { useState } from 'react';
import { useRoomContext } from '../../contexts/RoomContext';

export default function ShareLink() {
  const { room } = useRoomContext();
  const [notice, setNotice] = useState('');
  const [manualCopy, setManualCopy] = useState(false);
  if (!room) return null;
  const url = window.location.origin + '/room/' + room.id;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setNotice('초대 링크를 복사했어요.'); setManualCopy(false);
    } catch {
      setManualCopy(true); setNotice('아래 링크를 길게 눌러 복사해주세요.');
    }
  };
  const share = async () => {
    if (!navigator.share) { await copy(); return; }
    try { await navigator.share({ title: 'Connection 모임 초대', text: '모임에 참여해 서로의 위치를 확인하세요.', url }); }
    catch (error) { if ((error as DOMException).name !== 'AbortError') await copy(); }
  };
  return <div>
    <div className="flex items-center gap-2 min-w-0">
      <span className="flex-1 min-w-0 text-xs text-gray-500 truncate" title={url}>초대 링크 · {room.id.slice(-6)}</span>
      <button type="button" className="secondary-button" onClick={() => void copy()}>복사</button>
      <button type="button" className="primary-button" onClick={() => void share()}>초대하기</button>
    </div>
    {notice && <p role="status" className="text-xs text-primary-700 dark:text-primary-300 mt-1">{notice}</p>}
    {manualCopy && <input aria-label="직접 복사할 초대 링크" className="form-input mt-2" readOnly value={url} onFocus={event => event.currentTarget.select()} />}
  </div>;
}
