import { useEffect, useRef } from 'react';

/**
 * Hook đồng bộ dữ liệu thời gian thực không cần nhấn F5:
 * - Lắng nghe sự kiện WebSocket (hrm:recruitment-sync, hrm:tech-sync, hrm:notification).
 * - Tự động đồng bộ im lặng ngay khi người dùng chuyển quay lại tab trình duyệt (visibilitychange / window focus).
 * - Hỗ trợ cờ `paused` để không ghi đè khi người dùng đang mở form/nhập liệu.
 */
export default function useRealtimeSync(
  onSync,
  {
    events = ['hrm:recruitment-sync'],
    refreshOnFocus = true,
    paused = false,
    throttleMs = 800,
  } = {}
) {
  const callbackRef = useRef(onSync);
  callbackRef.current = onSync;

  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const lastRunRef = useRef(0);

  useEffect(() => {
    const trigger = (eventDetail) => {
      if (pausedRef.current) return;
      const now = Date.now();
      if (now - lastRunRef.current < throttleMs) return;
      lastRunRef.current = now;
      try {
        callbackRef.current?.(eventDetail);
      } catch (err) {
        console.debug('[useRealtimeSync] Lỗi đồng bộ nền:', err);
      }
    };

    const customHandlers = (events || []).map((eventName) => {
      const handler = (e) => trigger(e?.detail || { source: eventName });
      window.addEventListener(eventName, handler);
      return [eventName, handler];
    });

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        trigger({ source: 'visibility' });
      }
    };
    const handleFocus = () => {
      trigger({ source: 'focus' });
    };

    if (refreshOnFocus) {
      document.addEventListener('visibilitychange', handleVisibility);
      window.addEventListener('focus', handleFocus);
    }

    return () => {
      customHandlers.forEach(([eventName, handler]) => {
        window.removeEventListener(eventName, handler);
      });
      if (refreshOnFocus) {
        document.removeEventListener('visibilitychange', handleVisibility);
        window.removeEventListener('focus', handleFocus);
      }
    };
  }, [JSON.stringify(events), refreshOnFocus, throttleMs]);
}
