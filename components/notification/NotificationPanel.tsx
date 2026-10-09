import React, { memo } from 'react';

export interface NotificationItem {
  id: string;
  type: 'reaction' | 'comment' | 'reply' | 'tag' | 'message' | 'metric_help' | 'badge' | 'system' | 'goal_completed' | 'goal_reminder';
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
  referenceId?: string;
  actorId?: string;
  actorName?: string;
}

interface NotificationPanelProps {
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  onNotificationClick: (notif: NotificationItem) => void;
  onClose: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = memo(({ 
  notifications, onMarkAllRead, onNotificationClick, onClose, isMuted, onToggleMute 
}) => {
  const unreadCount = notifications.filter(n => !n.read).length;

  const formatTime = (timestamp: string) => {
    const d = new Date(timestamp);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60000) return 'Vừa xong';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ trước`;
    return d.toLocaleDateString('vi-VN');
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'reaction': return '❤️';
      case 'comment': return '💬';
      case 'reply': return '↩️';
      case 'tag': return '@';
      case 'message': return '📩';
      case 'metric_help': return '📊';
      case 'badge': return '🏆';
      case 'system': return '🔔';
      case 'goal_completed': return '🎉';
      case 'goal_reminder': return '⏰';
      default: return '📌';
    }
  };

  return (
    <div className="fixed left-1/2 z-[100] mt-3 w-[calc(100vw-2rem)] -translate-x-1/2 overflow-hidden rounded-[28px] border border-slate-200 bg-white/95 shadow-[0_30px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:absolute sm:left-auto sm:right-0 sm:w-80 sm:translate-x-0">
      <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-50 to-emerald-50 px-5 py-4">
        <div>
          <p className="text-sm font-black text-slate-800">Thông báo</p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            {unreadCount > 0 ? `${unreadCount} chưa đọc` : 'Không có thông báo mới'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onToggleMute && (
            <label className="flex cursor-pointer items-center gap-1 select-none" title={isMuted ? 'Bật popup thông báo' : 'Tắt popup thông báo'}>
              <input type="checkbox" checked={!isMuted} onChange={onToggleMute} className="h-3 w-3 rounded accent-emerald-600" />
              <span className={`text-[9px] font-black uppercase tracking-[0.12em] ${isMuted ? 'text-slate-400' : 'text-emerald-600'}`}>
                {isMuted ? '🔕' : '🔔'}
              </span>
            </label>
          )}
          {unreadCount > 0 && (
            <button onClick={onMarkAllRead} className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-600 hover:text-emerald-700">
              Đọc hết
            </button>
          )}
          <button onClick={onClose} className="text-lg text-slate-300 transition hover:text-slate-500">✕</button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
        {notifications.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="mb-2 text-3xl">🔔</p>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Chưa có thông báo nào</p>
          </div>
        ) : (
          notifications.map(notif => (
            <button
              key={notif.id}
              onClick={() => onNotificationClick(notif)}
              className={`flex w-full items-start gap-3 px-5 py-3.5 text-left transition hover:bg-slate-50 ${!notif.read ? 'bg-emerald-50/60' : ''}`}
            >
              <span className="mt-0.5 shrink-0 text-xl">{getIcon(notif.type)}</span>
              <div className="min-w-0 flex-1">
                <p className={`text-xs leading-relaxed ${!notif.read ? 'font-black text-slate-800' : 'font-bold text-slate-600'}`}>
                  {notif.message}
                </p>
                <p className="mt-1 text-[10px] font-bold text-slate-400">{formatTime(notif.timestamp)}</p>
              </div>
              {!notif.read && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />}
            </button>
          ))
        )}
      </div>
    </div>
  );
});

NotificationPanel.displayName = 'NotificationPanel';
export default NotificationPanel;