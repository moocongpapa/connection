import MapView from '../Map/MapView';
import RoomHeader from '../Room/RoomHeader';
import MemberList from '../UI/MemberList';
import LocationToggle from '../UI/LocationToggle';
import RoomTools from '../Room/RoomTools';

export default function DesktopLayout() {
  return <main className="room-page flex-row bg-gray-100 dark:bg-gray-900">
    <div className="flex-1 relative min-w-0"><MapView /></div>
    <aside className="w-[380px] flex flex-col bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700">
      <RoomHeader />
      <div className="p-4 overflow-y-auto flex-1 space-y-4"><LocationToggle /><MemberList /><RoomTools /></div>
    </aside>
  </main>;
}
