import { useState, useEffect, useRef, useCallback } from 'react';
import { notificationApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
}

const POLL_INTERVAL_MS = 30_000;

function isNotification(value: unknown): value is Notification {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    ['id', 'type', 'title', 'message', 'createdAt'].every((key) => typeof item[key] === 'string') &&
    typeof item.read === 'boolean' &&
    Number.isFinite(Date.parse(item.createdAt as string)) &&
    !!item.metadata &&
    typeof item.metadata === 'object' &&
    !Array.isArray(item.metadata)
  );
}

function currentReadScope() {
  const { authenticated, authType, userId, email, dashboardAccessId } = useAuthStore.getState();
  return JSON.stringify([authenticated, authType, userId, email, dashboardAccessId]);
}

export default function NotificationBell({ className = '' }: { className?: string } = {}) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const authType = useAuthStore((s) => s.authType);
  const authenticated = useAuthStore((s) => s.authenticated);
  const userId = useAuthStore((s) => s.userId);
  const email = useAuthStore((s) => s.email);
  const dashboardAccessId = useAuthStore((s) => s.dashboardAccessId);
  const scope = JSON.stringify([authenticated, authType, userId, email, dashboardAccessId]);
  const [readState, setReadState] = useState<'pending' | 'ready' | 'error'>('pending');
  const [readScope, setReadScope] = useState<string | null>(null);
  const sequence = useRef(0);
  const pending = useRef(false);
  const shouldShow = authenticated && authType === 'email';

  const fetchNotifications = useCallback(async () => {
    if (!shouldShow || pending.current) return;
    pending.current = true;
    const request = ++sequence.current;
    const isCurrent = () => request === sequence.current && scope === currentReadScope();
    setReadScope(scope);
    setReadState('pending');
    try {
      const res = await notificationApi.getNotifications({ limit: 20 });
      if (!isCurrent()) return;
      const payload = res.data;
      if (
        !Array.isArray(payload?.data) ||
        !payload.data.every(isNotification) ||
        !Number.isSafeInteger(payload.unreadCount) ||
        payload.unreadCount < 0
      ) {
        throw new Error('Invalid notifications response');
      }
      setNotifications(payload.data);
      setUnreadCount(payload.unreadCount);
      setReadState('ready');
    } catch {
      if (isCurrent()) setReadState('error');
    } finally {
      if (isCurrent()) pending.current = false;
    }
  }, [scope, shouldShow]);

  // Only show for email-authenticated users
  const ready = readScope === scope && readState === 'ready';
  const invalidateRead = useCallback(() => {
    ++sequence.current;
    pending.current = false;
  }, []);

  useEffect(() => {
    if (!shouldShow) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      invalidateRead();
    };
  }, [shouldShow, fetchNotifications, invalidateRead]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      /* ignore */
    }
  };

  const handleMarkAllAsRead = async () => {
    setLoading(true);
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      /* ignore */
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await notificationApi.deleteNotification(id);
      const removed = notifications.find((n) => n.id === id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (removed && !removed.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch {
      /* ignore */
    }
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'coding_added':
        return '{ }';
      case 'canvas_shared':
        return '\u{1F4CB}';
      case 'team_invite':
        return '\u{1F465}';
      case 'comment':
        return '\u{1F4AC}';
      case 'mention':
        return '@';
      default:
        return '\u{1F514}';
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (!shouldShow) return null;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative min-h-11 min-w-11 p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
        title="Notifications"
        aria-expanded={isOpen}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {ready && unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 bottom-full mb-2 w-64 sm:w-80 max-h-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</h3>
            {ready && unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={loading}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium disabled:opacity-50"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="overflow-y-auto flex-1">
            {readScope !== scope || readState === 'pending' ? (
              <div
                role="status"
                aria-label="Loading notifications"
                className="px-4 py-8 text-center text-sm text-gray-600 dark:text-gray-300"
              >
                Loading notifications…
              </div>
            ) : readState === 'error' ? (
              <div role="region" aria-label="Notification read recovery" className="px-4 py-6 text-center space-y-3">
                <p role="alert" className="text-sm text-gray-600 dark:text-gray-300">
                  We couldn't load your notifications. Try again to see current updates.
                </p>
                <button
                  type="button"
                  onClick={() => void fetchNotifications()}
                  className="w-full min-h-11 min-w-11 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Try loading notifications again
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">No notifications yet</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 dark:border-gray-750 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer ${
                    !n.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                  }`}
                  onClick={() => !n.read && handleMarkAsRead(n.id)}
                >
                  <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-sm">
                    {typeIcon(n.type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm ${!n.read ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}
                    >
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{n.message}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{timeAgo(n.createdAt)}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(n.id);
                    }}
                    className="flex-shrink-0 p-1 text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors"
                    title="Delete notification"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
