import { useEffect, useRef, useState } from 'react';
import MapView from '../Map/MapView';
import RoomHeader from '../Room/RoomHeader';
import MemberList from '../UI/MemberList';
import LocationToggle from '../UI/LocationToggle';
import RoomTools from '../Room/RoomTools';
import { useRoomContext } from '../../contexts/RoomContext';

export default function MobileLayout() {
  const { members, pickingPoint } = useRoomContext();
  const [expanded, setExpanded] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const mapArea = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (pickingPoint) setExpanded(false);
  }, [pickingPoint]);
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      mapArea.current?.style.setProperty('--mobile-panel-height', (panel.current?.getBoundingClientRect().height ?? 180) + 'px');
    });
    if (panel.current) observer.observe(panel.current);
    return () => observer.disconnect();
  }, []);
  return <main className="room-page bg-gray-100 dark:bg-gray-900">
    <RoomHeader isMobile />
    <div ref={mapArea} data-map-area className="relative flex-1 min-h-0">
      <MapView />
      <section ref={panel} data-mobile-panel className="mobile-room-panel" aria-label="모임 제어">
        <div className="shrink-0"><LocationToggle /></div>
        <button type="button" className="touch-button w-full shrink-0 justify-between gap-3 px-1 font-semibold"
          aria-expanded={expanded} aria-controls="mobile-members" onClick={() => setExpanded(value => !value)}>
          <span>참여자 {members.length}명</span><span className="text-sm text-primary-600">{expanded ? '접기' : '목록 · 모임 설정'}</span>
        </button>
        <div id="mobile-members" className={'min-h-0 overflow-y-auto overscroll-contain ' + (expanded ? 'max-h-[42dvh]' : '')}>
          <MemberList compact={!expanded} />
          {expanded && <div className="mt-4"><RoomTools /></div>}
        </div>
      </section>
    </div>
  </main>;
}
