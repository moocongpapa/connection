import React, { useEffect, useState } from 'react';
import { isAndroid, isInAppBrowser, isKakaoTalk, isStandalone, openInExternalBrowser } from '../../utils/browserUtils';

interface InAppNoticeProps {
  roomId?: string;
}

export default function InAppNotice({ roomId }: InAppNoticeProps) {
  const [dismissed, setDismissed] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const inApp = isInAppBrowser();
  const standalone = isStandalone();
  const isKakao = isKakaoTalk();
  const isAndr = isAndroid();

  // On Android KakaoTalk, attempt automatic redirection once if entering a room
  useEffect(() => {
    if (!inApp || standalone || dismissed || !isAndr || !isKakao) return;
    try {
      const alreadyAttempted = sessionStorage.getItem('connection_inapp_escape');
      if (!alreadyAttempted) {
        sessionStorage.setItem('connection_inapp_escape', 'true');
        openInExternalBrowser();
      }
    } catch {
      // Ignore storage errors in restricted webviews
    }
  }, [inApp, standalone, dismissed, isAndr, isKakao]);

  if (!inApp || standalone || dismissed) {
    return null;
  }

  const currentUrl = window.location.href;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    } catch {
      // Fallback: prompt or alert
      const textarea = document.createElement('textarea');
      textarea.value = currentUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    }
  };

  return (
    <div
      role="region"
      aria-label="외부 브라우저 열기 안내"
      className="mb-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-100 text-sm shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200">
          <span>{isKakao ? '💬 카카오톡 인앱 브라우저 안내' : '🌐 인앱 브라우저 안내'}</span>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-amber-700 dark:text-amber-300 hover:text-amber-950 dark:hover:text-amber-100 text-xs px-2 py-1"
          aria-label="안내 닫기"
        >
          ✕ 닫기
        </button>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-amber-900/90 dark:text-amber-200/90">
        카카오톡 내부에서는 <strong>설치된 앱(PWA) 연동</strong> 및 <strong>백그라운드 위치 공유</strong>가 제한될 수 있습니다.
        {isAndr ? (
          ' 원활한 이용을 위해 Chrome 또는 설치된 Connection 앱으로 열어주세요.'
        ) : (
          ' 우측 상단/하단 더보기(···) 메뉴에서 [Safari로 열기]를 권장합니다.'
        )}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {isAndr && (
          <button
            type="button"
            onClick={() => openInExternalBrowser()}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs rounded-lg shadow-xs transition-colors"
          >
            Chrome / 설치된 앱으로 열기
          </button>
        )}
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="px-3 py-1.5 bg-white dark:bg-amber-900/60 border border-amber-300 dark:border-amber-700 font-medium text-xs rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/80 transition-colors"
        >
          {copySuccess ? '✓ 링크 복사 완료!' : '초대 링크 복사'}
        </button>
      </div>

      {roomId && (
        <p className="mt-2 text-[11px] text-amber-800/80 dark:text-amber-300/80">
          💡 이미 홈 화면에 앱을 설치하셨다면 링크를 복사한 뒤, 앱 첫 화면에서 <strong>[초대 코드로 참여]</strong>를 눌러 바로 입장하실 수 있습니다.
        </p>
      )}
    </div>
  );
}
