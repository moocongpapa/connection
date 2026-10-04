import { useEffect, useState } from 'react';

export function usePageVisibility() {
  const [visible, setVisible] = useState(document.visibilityState === 'visible');
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', update);
    window.addEventListener('pageshow', update);
    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('pageshow', update);
    };
  }, []);
  return visible;
}
export function useClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}
