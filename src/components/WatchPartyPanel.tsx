"use client";

import { useEffect, useRef, useState } from 'react';
import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import LiquidGlassContainer from './LiquidGlassContainer';
import { Users, Copy as CopyIcon, Crown, Wifi } from 'lucide-react';

type ChatMsg = { id: string; sender?: string; text: string; ts: number };

export default function WatchPartyPanel() {
  const [room, setRoom] = useState('');
  const [name, setName] = useState('');
  const [connected, setConnected] = useState(false);
  // 默认不持续跟随主机，仅在加入时对齐一次进度
  const [followHost, setFollowHost] = useState(false);
  const [members, setMembers] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatText, setChatText] = useState('');

  const esRef = useRef<EventSource | null>(null);
  const selfIdRef = useRef<string>('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const suppressRef = useRef<boolean>(false);
  const createdRoomRef = useRef<boolean>(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    selfIdRef.current = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // 从 URL 读取房间和昵称（支持邀请链接：?room=xxx&name=yyy）
    try {
      const sp = new URLSearchParams(window.location.search);
      const r = sp.get('room');
      const n = sp.get('name');
      if (r) setRoom(r);
      if (n) setName(n);
    } catch {}
    // 从登录信息自动填充昵称
    try {
      const auth = getAuthInfoFromBrowserCookie();
      if (auth?.username && !name) setName(auth.username);
    } catch {}
  }, []);

  useEffect(() => {
    // 新消息到达时自动滚动到底部
    try {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch {}
  }, [messages]);

  const getVideo = (): HTMLVideoElement | null => {
    if (videoRef.current && document.contains(videoRef.current)) return videoRef.current;
    const v = document.querySelector('video');
    videoRef.current = v as HTMLVideoElement | null;
    return videoRef.current;
  };

  const emit = (type: string, payload: Record<string, unknown>) => {
    if (!room) return;
    fetch('/api/watchparty/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room, type, sender: selfIdRef.current, payload })
    }).catch(() => {});
  };

  const connect = () => {
    if (!room) {
      // 如果用户未填写，自动生成一个临时房间号
      setRoom((prev) => {
        if (prev && prev.length > 0) return prev;
        const generated = generateRoomId();
        createdRoomRef.current = true;
        return generated;
      });
    }
    disconnect();
    const targetRoom = room || generateRoomId();
    if (!room) createdRoomRef.current = true;
    const es = new EventSource(`/api/watchparty/events?room=${encodeURIComponent(targetRoom)}`);
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (!data) return;
        if (data.type === 'playback') {
          if (data.sender === selfIdRef.current) return;
          const v = getVideo();
          if (!v) return;
          // 加入时一次性对齐主机进度；如果启用“跟随主机”则持续跟随
          const applySync = () => {
            suppressRef.current = true;
            if (typeof data.payload?.time === 'number') {
              v.currentTime = data.payload.time;
            }
            if (data.payload?.state === 'play') {
              void v.play();
            } else if (data.payload?.state === 'pause') {
              v.pause();
            }
            setTimeout(() => (suppressRef.current = false), 300);
          };
          if (data.initial) {
            applySync();
          } else if (followHost) {
            applySync();
          }
        } else if (data.type === 'presence') {
          const memberName = (data.payload?.name as string) || '未知用户';
          if (data.payload?.action === 'join') {
            setMembers((prev) => (prev.includes(memberName) ? prev : [...prev, memberName]));
          } else if (data.payload?.action === 'leave') {
            setMembers((prev) => prev.filter((m) => m !== memberName));
          }
        } else if (data.type === 'members') {
          const list = Array.isArray(data.payload?.members) ? (data.payload.members as string[]) : [];
          setMembers(list);
        } else if (data.type === 'chat') {
          const msg: ChatMsg = {
            id: `${data.ts}-${Math.random().toString(36).slice(2, 6)}`,
            sender: data.sender,
            text: String(data.payload?.text || ''),
            ts: data.ts || Date.now()
          };
          setMessages((prev) => [...prev.slice(-50), msg]);
        }
      } catch {}
    };
    es.onerror = () => {
      // 浏览器自动重连
    };
    esRef.current = es;
    setConnected(true);
    // 广播加入
    emit('presence', { action: 'join', name, isHost: createdRoomRef.current });
    ensureVideoListeners();

    // 连接后无论是否为创建者，都主动上报一次当前播放状态（稍作延迟），
    // 服务端仅记录主机的状态，其它成员不会覆盖。
    setTimeout(() => {
      const v = getVideo();
      if (v) {
        const state = v.paused ? 'pause' : 'play';
        emit('playback', { state, time: v.currentTime });
      }
    }, 150);
  };

  const disconnect = () => {
    if (connected) {
      emit('presence', { action: 'leave', name });
    }
    esRef.current?.close();
    esRef.current = null;
    setConnected(false);
  };

  const ensureVideoListeners = () => {
    const v = getVideo();
    if (!v) return;
    const onPlay = () => {
      if (suppressRef.current) return;
      emit('playback', { state: 'play', time: v.currentTime });
    };
    const onPause = () => {
      if (suppressRef.current) return;
      emit('playback', { state: 'pause', time: v.currentTime });
    };
    const onSeeked = () => {
      if (suppressRef.current) return;
      emit('playback', { state: 'seek', time: v.currentTime });
    };
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('seeked', onSeeked);
  };

  const sendChat = () => {
    if (!chatText.trim()) return;
    emit('chat', { text: chatText.trim(), name });
    setChatText('');
  };

  const generateRoomId = () => {
    // 生成 6 位房间号：字母数字混合
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = '';
    for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
  };

  const createRoom = () => {
    const id = generateRoomId();
    setRoom(id);
    createdRoomRef.current = true;
  };

  const copyInvite = async () => {
    try {
      const url = new URL(window.location.href);
      const sp = new URLSearchParams(url.search);
      if (room) sp.set('room', room);
      if (name) sp.set('name', name);
      url.search = sp.toString();
      const invite = url.toString();
      await navigator.clipboard.writeText(invite);
      setMessages((prev) => [...prev.slice(-50), { id: `sys-${Date.now()}`, text: '已复制邀请链接', ts: Date.now() }]);
    } catch {
      setMessages((prev) => [...prev.slice(-50), { id: `sys-${Date.now()}`, text: '复制失败，请手动复制地址栏', ts: Date.now() }]);
    }
  };

  return (
    <div className='space-y-3'>
      {/* 顶部工具栏 */}
      <LiquidGlassContainer className='px-3 py-2 flex items-center gap-2' roundedClass='rounded-full' intensity='medium' shadow='lg' border='subtle'>
        {/* 连接状态与主机徽标 */}
        <span className={`flex items-center gap-1 text-xs ${connected ? 'text-green-600' : 'text-gray-500'} `}>
          <Wifi className='w-3 h-3' />
          {connected ? '已加入' : '未加入'}
        </span>
        {createdRoomRef.current && (
          <span className='text-[10px] px-2 py-[2px] rounded-full bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 flex items-center gap-1'>
            <Crown className='w-3 h-3' /> 主机
          </span>
        )}

        {/* 房间信息与邀请 */}
        <span className='ml-1 text-xs px-2 py-1 rounded-full bg-white/60 dark:bg-gray-800/40 border border-white/30 dark:border-gray-700/40 text-gray-700 dark:text-gray-200'>
          房间：{room || '未设置'}
        </span>
        <button onClick={copyInvite} title='复制邀请链接' className='text-xs px-2 py-1 rounded-full bg-gray-700 text-white hover:bg-gray-800 flex items-center gap-1'>
          <CopyIcon className='w-3 h-3' />复制
        </button>
        <button onClick={createRoom} className='text-xs px-2 py-1 rounded-full bg-indigo-600 text-white hover:bg-indigo-700'>生成
        </button>

        {/* 昵称 */}
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder='昵称' className='text-xs px-2 py-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white/80 dark:bg-gray-800/60' />

        {/* 加入/离开 */}
        {!connected ? (
          <button onClick={connect} className='text-xs px-3 py-1 rounded-full bg-green-600 text-white hover:bg-green-700'>加入/创建</button>
        ) : (
          <button onClick={disconnect} className='text-xs px-3 py-1 rounded-full bg-red-600 text-white hover:bg-red-700'>离开</button>
        )}

        {/* 跟随主机开关 */}
        <label className='ml-auto flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300'>
          <input type='checkbox' checked={followHost} onChange={(e) => setFollowHost(e.target.checked)} />
          跟随主机
        </label>
      </LiquidGlassContainer>

      {/* 成员与聊天 */}
      <LiquidGlassContainer className='px-3 py-2' roundedClass='rounded-2xl' intensity='medium' shadow='lg' border='subtle'>
        <div className='flex items-center justify-between mb-2'>
          <div className='flex items-center gap-2'>
            <span className='text-xs font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1'><Users className='w-3 h-3' />成员</span>
            <div className='flex items-center gap-1'>
              {members.length === 0 && <span className='text-xs text-gray-500 dark:text-gray-400'>暂无成员</span>}
              {members.slice(0, 6).map((m, i) => (
                <span key={`${m}-${i}`} className='text-[10px] px-2 py-[2px] rounded-full bg-white/60 dark:bg-gray-800/40 border border-white/30 dark:border-gray-700/40 text-gray-700 dark:text-gray-200'>
                  {m.slice(0, 8)}
                </span>
              ))}
              {members.length > 6 && (
                <span className='text-[10px] px-2 py-[2px] rounded-full bg-white/60 dark:bg-gray-800/40 border border-white/30 dark:border-gray-700/40 text-gray-700 dark:text-gray-200'>+{members.length - 6}</span>
              )}
            </div>
          </div>
          <span className='text-xs text-gray-600 dark:text-gray-400'>共 {members.length} 人</span>
        </div>

        <div className='text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2'>聊天</div>
        <div className='h-32 overflow-y-auto rounded-md bg-white/50 dark:bg-gray-800/50 border border-white/20 dark:border-gray-700/40 p-2'>
          {messages.length === 0 && <div className='text-xs text-gray-500 dark:text-gray-400'>暂无消息</div>}
          {messages.map((msg) => {
            const self = msg.sender === selfIdRef.current;
            return (
              <div key={msg.id} className={`flex ${self ? 'justify-end' : 'justify-start'} mb-1`}>
                <div className={`max-w-[75%] px-2 py-1 rounded-2xl text-xs ${self ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100'}`}>
                  {msg.text}
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>
        <div className='mt-2 flex items-center gap-2'>
          <input value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder='输入消息' className='flex-1 text-xs px-2 py-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white/80 dark:bg-gray-800/60' />
          <button onClick={sendChat} className='text-xs px-3 py-1 rounded-full bg-blue-600 text-white hover:bg-blue-700'>发送</button>
        </div>
      </LiquidGlassContainer>
    </div>
  );
}