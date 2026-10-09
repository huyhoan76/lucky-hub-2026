/**
 * ContactList - Danh sách chat với online status, unread badge
 * Sắp xếp: Trợ lý AI → Coach → Người dùng khác
 * Trong cùng nhóm: unread > 0 lên trước → tin nhắn gần nhất
 */
import React, { memo, useMemo, useState, useCallback, useEffect } from 'react';
import { ChatSession, ChatGroup } from '../../../types.ts';
import { useChat } from '../ChatProvider.tsx';
import { Database } from '../../../services/database.ts';

interface ContactListProps {
  onSelectContact?: (chat: ChatSession) => void;
}

/** Hàm lấy độ ưu tiên: 0 = AI, 1 = Coach, 2 = Others */
const getPriority = (chat: ChatSession, other: any): number => {
  if (chat.coachId === 'ai_coach') return 0;
  const role = (other as any)?.role;
  if (role === 'COACH') return 1;
  return 2;
};

const ContactList: React.FC<ContactListProps> = memo(({ onSelectContact }) => {
  const { chats, selectedChat, selectChat, getOtherUser, onlineUsers, unreadCounts } = useChat();
  const [searchTerm, setSearchTerm] = useState('');
  const [chatGroups, setChatGroups] = useState<any[]>([]);
  const [showGroups, setShowGroups] = useState(false);

  // Fetch chat groups
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const data = await Database.getChatGroups();
        setChatGroups(data || []);
      } catch (err) {
        console.error('[ContactList] Failed to load chat groups:', err);
      }
    };
    fetchGroups();
  }, []);

  const handleSelect = useCallback((chat: ChatSession) => {
    selectChat(chat);
    onSelectContact?.(chat);
  }, [selectChat, onSelectContact]);

  // Sắp xếp chats: ưu tiên AI → Coach → Others, sau đó unread → latest message
  const sortedChats = useMemo(() => {
    return [...chats].sort((a, b) => {
      const otherA = getOtherUser(a);
      const otherB = getOtherUser(b);
      const prioA = getPriority(a, otherA);
      const prioB = getPriority(b, otherB);

      // Theo nhóm ưu tiên
      if (prioA !== prioB) return prioA - prioB;

      // Trong cùng nhóm: ưu tiên chưa đọc
      const aUnread = unreadCounts[a.id] || 0;
      const bUnread = unreadCounts[b.id] || 0;
      if (bUnread > 0 && aUnread === 0) return 1;
      if (aUnread > 0 && bUnread === 0) return -1;

      // Cùng unread status: sắp xếp theo tin nhắn gần nhất
      const aLastMsg = a.messages[a.messages.length - 1];
      const bLastMsg = b.messages[b.messages.length - 1];
      if (aLastMsg && bLastMsg) {
        return new Date(bLastMsg.timestamp).getTime() - new Date(aLastMsg.timestamp).getTime();
      }
      if (aLastMsg) return -1;
      if (bLastMsg) return 1;
      return 0;
    });
  }, [chats, unreadCounts, getOtherUser]);

  // Lọc theo từ khóa tìm kiếm
  const filteredChats = useMemo(() => {
    if (!searchTerm.trim()) return sortedChats;
    const term = searchTerm.toLowerCase().trim();
    return sortedChats.filter(chat => {
      const other = getOtherUser(chat);
      if (!other) return false;
      return other.fullName.toLowerCase().includes(term);
    });
  }, [sortedChats, searchTerm, getOtherUser]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  return (
    <div className="flex-grow overflow-y-auto overflow-x-hidden bg-slate-50/40" style={{ overscrollBehavior: 'contain' }}>
      <div className="px-4 pb-2 pt-4">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">🔍</span>
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Tìm kiếm hội thoại..."
            className="w-full rounded-2xl border border-slate-200 bg-white px-9 py-2.5 text-xs font-medium text-slate-600 placeholder:text-slate-300 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-[10px] text-slate-300 transition hover:text-slate-500">
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="mb-2 px-4">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">💬 Hội thoại của bạn</div>
      </div>

      {filteredChats.length === 0 ? (
        <div className="space-y-4 p-8 text-center">
          <div className="text-4xl">🏜️</div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{searchTerm ? 'Không tìm thấy kết quả' : 'Chưa có ai để chat'}</p>
          {!searchTerm && <p className="text-[10px] text-slate-300">Nếu bạn là thành viên, hãy chờ Admin hoặc Coach xuất hiện nhé!</p>}
        </div>
      ) : filteredChats.map(chat => {
        const other = getOtherUser(chat);
        if (!other) return null;

        const otherId = (other as any).id || (other as any)._id;
        const isOnline = onlineUsers.has(otherId);
        const unreadCount = unreadCounts[chat.id] || 0;
        const isSelected = selectedChat?.id === chat.id;
        const lastMessage = chat.messages[chat.messages.length - 1];
        const isAiCoach = chat.coachId === 'ai_coach';

        return (
          <div key={chat.id} onClick={() => handleSelect(chat)} className={`mx-4 mb-2 flex cursor-pointer items-center gap-3 rounded-[24px] border p-3.5 transition ${isSelected ? 'border-emerald-200 bg-emerald-50 shadow-sm' : 'border-transparent bg-white hover:border-slate-200 hover:shadow-sm'}`}>
            <div className="relative shrink-0">
              <div className={`flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl text-sm font-black ${isAiCoach ? 'bg-amber-100 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                {(other as any).avatar ? <img src={(other as any).avatar} alt={other.fullName} className="h-full w-full object-cover" /> : <span>{isAiCoach ? '🍀' : other.fullName.charAt(0)}</span>}
              </div>
              {isOnline && <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className={`truncate text-xs font-black ${isSelected ? 'text-emerald-700' : 'text-slate-700'}`}>{other.fullName}</div>
                  {isOnline && <span className="text-[8px] font-black text-emerald-500">🟢 online</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">{isAiCoach ? 'AI' : (other as any).role === 'ADMIN' ? 'ADMIN' : (other as any).role === 'COACH' ? 'COACH' : ''}</span>
                  {unreadCount > 0 && <span className="min-w-[18px] rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[8px] font-black text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
                </div>
              </div>

              {lastMessage && (
                <p className="mt-1 truncate text-[10px] text-slate-400">
                  {lastMessage.senderId === otherId ? '' : 'Bạn: '}
                  {lastMessage.content?.substring(0, 50)}
                  {lastMessage.content?.length > 50 ? '...' : ''}
                </p>
              )}
            </div>
          </div>
        );
      })}

      {chatGroups.length > 0 && (
        <>
          <div className="mb-2 mt-4 px-4">
            <button onClick={() => setShowGroups(!showGroups)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 transition hover:text-slate-600">
              👥 Nhóm ({chatGroups.length}) {showGroups ? '▲' : '▼'}
            </button>
          </div>
          {showGroups && chatGroups.map((g: any) => (
            <div
              key={g.id || g._id}
              className="mx-4 mb-2 p-4 rounded-2xl bg-indigo-50 border border-indigo-100 cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-sm shrink-0">
                  👥
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-xs text-indigo-700 truncate">{g.name}</div>
                  {g.lastMessage && (
                    <p className="text-[10px] text-indigo-400 mt-0.5 truncate">
                      {g.lastMessage.senderName}: {g.lastMessage.content?.substring(0, 40)}
                    </p>
                  )}
                  {!g.lastMessage && (
                    <p className="text-[10px] text-indigo-300 mt-0.5">{g.memberIds?.length || 0} thành viên</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
});

ContactList.displayName = 'ContactList';

export default ContactList;