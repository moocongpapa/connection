import { useState } from 'react';
import { useRoomContext } from '../../contexts/RoomContext';
import { directionsUrl, isFreshLocation } from '../../utils/locationUtils';

export default function RoomTools() {
  const { room, isCreator, myLocation, chooseMeetingPoint, pickingPoint, setPickingPoint, precision, setPrecision, panToLocation, keepScreen, setKeepScreen, wake } = useRoomContext();
  const [label, setLabel] = useState('');
  const point = room?.meetingPoint;
  return <div className="space-y-4 border-t border-gray-100 dark:border-gray-700 pt-4">
    <div>
      <h3 className="font-semibold">만날 장소</h3>
      {point ? <div className="mt-2">
        <button type="button" className="touch-button font-semibold text-primary-600 dark:text-primary-300"
          onClick={() => panToLocation({ ...point, timestamp: Date.now() })}>{point.label} · 지도에서 보기</button>
        <a className="touch-button text-sm" href={directionsUrl(point)} target="_blank" rel="noopener noreferrer">만날 장소까지 길찾기</a>
        {isCreator && <button type="button" className="touch-button text-sm text-gray-500" onClick={() => void chooseMeetingPoint(null)}>장소 지우기</button>}
      </div> : <p className="text-sm text-gray-500 mt-2">모임을 만든 사람이 만날 장소를 지정할 수 있어요.</p>}
      {isCreator && <div className="mt-2">
        <label htmlFor="meeting-label" className="text-sm">장소 이름</label>
        <input id="meeting-label" className="form-input mt-1" value={label} maxLength={40} placeholder="예: 정문 앞"
          onChange={event => setLabel(event.target.value)} />
        <div className="flex flex-wrap gap-2 mt-2">
          <button type="button" className="secondary-button" disabled={!label.trim() || !isFreshLocation(myLocation)}
            onClick={() => myLocation && void chooseMeetingPoint({ lat: myLocation.lat, lng: myLocation.lng, label: label.trim() })}>내 위치로 지정</button>
          <button type="button" className="secondary-button" disabled={!label.trim() || !import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
            onClick={() => setPickingPoint(label.trim())}>지도에서 선택</button>
        </div>
        {pickingPoint && <button type="button" className="touch-button text-sm" onClick={() => setPickingPoint(null)}>장소 선택 취소</button>}
      </div>}
    </div>
    <div>
      <label htmlFor="location-precision" className="font-semibold block mb-2">위치 모드</label>
      <select id="location-precision" className="form-input" value={precision} onChange={event => setPrecision(event.target.value as 'precise' | 'balanced')}>
        <option value="precise">정확도 우선</option><option value="balanced">절전 우선</option>
      </select>
      <p className="text-xs text-gray-500 mt-2">절전 모드에서는 위치가 덜 정확할 수 있어요. 지도와 목록에서 정확도를 확인하세요.</p>
    </div>
    {wake.supported && <div>
      <button type="button" role="switch" aria-checked={keepScreen} className="touch-button text-sm w-full justify-between"
        onClick={() => setKeepScreen(value => !value)}><span>공유 중 화면 켜두기</span><span>{keepScreen ? wake.active ? '사용 중' : '대기 중' : '꺼짐'}</span></button>
      <p className="text-xs text-gray-500">화면 유지 기능은 배터리를 더 사용합니다.</p>
      {wake.error && <p role="status" className="text-xs text-amber-600 mt-2">{wake.error}</p>}
    </div>}
    <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">화면을 잠그거나 다른 앱을 사용하면 위치 갱신이 멈출 수 있어요. 다시 돌아오면 새 위치를 확인합니다. 메신저 안에서 위치가 안 잡히면 Safari 또는 Chrome으로 열어주세요.</p>
  </div>;
}
