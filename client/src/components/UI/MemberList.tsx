import React, { useState } from 'react';
import { useRoomContext } from '../../contexts/RoomContext';
import { Member } from '../../types';

interface MemberListProps {
  isMobile?: boolean;
  onMemberClick?: (lat: number, lng: number) => void;
}

const MemberList: React.FC<MemberListProps> = ({ isMobile = false, onMemberClick }) => {
  const { members, panToLocation } = useRoomContext();
  const [expanded, setExpanded] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleMemberClick = (member: Member) => {
    if (!member.isSharing) {
      showToast(`${member.nickname}님이 위치 공유를 껐습니다.`);
      return;
    }

    if (!member.location) {
      showToast(`${member.nickname}님의 GPS 위치를 수신 중입니다. 잠시만 기다려주세요.`);
      return;
    }

    if (onMemberClick) {
      onMemberClick(member.location.lat, member.location.lng);
    } else if (panToLocation) {
      panToLocation(member.location);
    }

    if (isMobile) setExpanded(false);
  };

  const renderMember = (member: Member) => {
    const timeAgo = member.lastUpdate 
      ? Math.round((Date.now() - member.lastUpdate) / 60000) 
      : 0;
    
    const isOnline = member.isOnline !== false;

    return (
      <div 
        key={member.id} 
        className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors cursor-pointer active:scale-[0.98]"
        onClick={() => handleMemberClick(member)}
        title={member.location ? "클릭하여 지도에서 위치 보기" : "위치 수신 중"}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <img 
              src={member.photoBase64} 
              alt={member.nickname} 
              className={`w-10 h-10 rounded-full object-cover border-2 ${
                isOnline && member.isSharing ? 'border-primary-500' : 'border-gray-300 dark:border-gray-600 grayscale'
              }`} 
            />
            <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${
              isOnline && member.isSharing ? 'bg-green-500' : 'bg-gray-400'
            }`}></div>
          </div>
          <div>
            <div className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              {member.nickname}
              {!isOnline && <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">자리비움</span>}
              {isOnline && !member.isSharing && <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded">숨김</span>}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              {!isOnline ? (
                <span className="text-gray-400 text-[11px]">마지막 위치 보존됨</span>
              ) : member.isSharing ? (
                member.location ? (
                  <>
                    <span>{timeAgo === 0 ? '방금 전' : `${timeAgo}분 전`}</span>
                    <span className="text-primary-500 text-[11px] font-medium">• 위치 보기</span>
                  </>
                ) : (
                  <span className="text-amber-500 text-[11px] font-medium animate-pulse flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                    위치 수신 대기 중...
                  </span>
                )
              ) : (
                '위치 공유 중지'
              )}
            </div>
          </div>
        </div>
        <div className="text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-gray-900/90 text-white text-xs px-4 py-2 rounded-full shadow-xl backdrop-blur-sm animate-fade-in pointer-events-none">
          {toastMessage}
        </div>
      )}

      {isMobile ? (
        <>
          {expanded && (
            <div 
              className="fixed inset-0 bg-black/20 z-40" 
              onClick={() => setExpanded(false)}
            />
          )}
          <div className={`bottom-sheet ${expanded ? 'expanded' : ''}`}>
            <div 
              className="w-full flex justify-center py-3 cursor-pointer"
              onClick={() => setExpanded(!expanded)}
            >
              <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
            </div>
            
            <div className="px-4 pb-4">
              {!expanded ? (
                <div className="flex overflow-x-auto pb-2 gap-3 no-scrollbar">
                  {members.map(member => (
                    <div 
                      key={member.id} 
                      className="flex flex-col items-center flex-shrink-0 cursor-pointer active:scale-95" 
                      onClick={() => handleMemberClick(member)}
                    >
                      <div className="relative">
                        <img 
                          src={member.photoBase64} 
                          alt={member.nickname} 
                          className={`w-12 h-12 rounded-full object-cover border-2 ${
                            member.isOnline !== false && member.isSharing ? 'border-primary-500' : 'border-gray-300 grayscale'
                          }`} 
                        />
                        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${
                          member.isOnline !== false && member.isSharing ? 'bg-green-500' : 'bg-gray-400'
                        }`}></div>
                      </div>
                      <span className="text-[10px] mt-1 text-gray-600 dark:text-gray-300 truncate w-14 text-center">{member.nickname}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="max-h-[50vh] overflow-y-auto pr-2">
                  <h3 className="font-bold text-gray-800 dark:text-white mb-3 px-2">참여자 목록 ({members.length})</h3>
                  <div className="space-y-1">
                    {members.map(renderMember)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 flex-1 flex flex-col min-h-0 border border-gray-100 dark:border-gray-700">
          <h3 className="font-bold text-gray-800 dark:text-white mb-3 pb-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <span>참여자 목록</span>
            <span className="text-xs bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 px-2 py-0.5 rounded-full font-bold">
              {members.length}명
            </span>
          </h3>
          <div className="overflow-y-auto flex-1 pr-1 space-y-1">
            {members.map(renderMember)}
          </div>
        </div>
      )}
    </>
  );
};

export default MemberList;
