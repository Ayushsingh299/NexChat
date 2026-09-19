import React, { useEffect, useState, useRef } from 'react';
import { Send, LogOut, User as UserIcon, Users as UsersIcon, Plus, Paperclip, File, X, Activity, Search, MoreVertical, Phone, Video, Mic, MicOff, VideoOff, PhoneMissed, Loader2, Settings, Shield, Trash2, Moon, Sun, Bell, Reply, Forward, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import { wsService } from '../services/websocket';
import { cryptoService } from '../services/cryptoService';
import { notificationService } from '../services/notificationService';
import { webrtcService } from '../services/webrtcService';
import { useNavigate, Link } from 'react-router-dom';
import CreateGroupModal from '../components/CreateGroupModal';
import UserProfileModal from '../components/UserProfileModal';
import SettingsModal from '../components/SettingsModal';
import SecurityCenterModal from '../components/SecurityCenterModal';
import GroupDetailsModal from '../components/GroupDetailsModal';
import ForwardMessageModal from '../components/ForwardMessageModal';

interface User {
  id: number;
  email: string;
  fullName: string;
  online?: boolean;
  lastSeen?: string;
  isBlocked?: boolean;
  publicKey?: string;
  bio?: string;
  statusMessage?: string;
  avatarUrl?: string;
}

interface ChatGroup {
  id: number;
  name: string;
  description: string;
  memberCount: number;
}

interface Message {
  id: number;
  senderId: number;
  recipientId: number;
  senderName: string;
  content: string;
  attachmentUrl?: string;
  status: string;
  sentiment?: string;
  spamScore?: number;
  isEdited?: boolean;
  isDeleted?: boolean;
  replyToMessageId?: number;
  reactions?: string;
  timestamp: string;
  expiresAt?: string;
  isE2EE?: boolean;
}

export default function Chat() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
  
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  
  const [activeChat, setActiveChat] = useState<User | null>(null);
  const [activeGroup, setActiveGroup] = useState<ChatGroup | null>(null);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expiresInSeconds, setExpiresInSeconds] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [showModal, setShowModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState<User | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<number | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [showGroupDetails, setShowGroupDetails] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(localStorage.getItem('theme') as 'dark' | 'light' || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const [contextMenuUser, setContextMenuUser] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{users: any[], groups: any[], messages: any[]} | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [chatStates, setChatStates] = useState<Record<string, {isPinned?: boolean, isMuted?: boolean, isArchived?: boolean}>>({});
  
  const [toast, setToast] = useState<{title: string, body: string} | null>(null);

  const activeChatRef = useRef(activeChat);
  const activeGroupRef = useRef(activeGroup);
  const chatStatesRef = useRef(chatStates);
  
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const lastSyncTimestampRef = useRef<string>(new Date().toISOString());

  useEffect(() => {
    activeChatRef.current = activeChat;
    activeGroupRef.current = activeGroup;
    chatStatesRef.current = chatStates;
  }, [activeChat, activeGroup, chatStates]);

  const toggleChatState = async (id: number, isGroup: boolean, field: 'isPinned' | 'isMuted' | 'isArchived') => {
    const key = isGroup ? `group_${id}` : `user_${id}`;
    const currentState = chatStates[key]?.[field] || false;
    const newState = !currentState;
    
    setChatStates(prev => ({ ...prev, [key]: { ...prev[key], [field]: newState } }));
    setContextMenuUser(null);
    
    try {
      if (isGroup) {
        await api.put(`/groups/${id}/manage`, { [field]: newState });
      } else {
        await api.put(`/api/v1/conversations/${id}/manage`, { [field]: newState });
      }
    } catch (err) {
      console.error('Failed to update chat state', err);
      setChatStates(prev => ({ ...prev, [key]: { ...prev[key], [field]: currentState } }));
    }
  };

  // Typing indicators: Map of email -> timestamp
  const [typingUsers, setTypingUsers] = useState<Map<string, number>>(new Map());
  
  // Message Control States
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);

  // WebRTC Call States
  const [incomingCall, setIncomingCall] = useState<any | null>(null);
  const [activeCall, setActiveCall] = useState<{ isVideo: boolean, recipientId: number } | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const toggleBlockUser = async () => {
    if (!activeChat) return;
    try {
      if (activeChat.isBlocked) {
        await api.post(`/users/${activeChat.id}/unblock`);
      } else {
        await api.post(`/users/${activeChat.id}/block`);
      }
      // Update local state
      setUsers(prev => prev.map(u => u.id === activeChat.id ? { ...u, isBlocked: !activeChat.isBlocked } : u));
      setActiveChat(prev => prev ? { ...prev, isBlocked: !prev.isBlocked } : null);
    } catch (err) {
      console.error("Failed to toggle block", err);
    }
  };

  // Cleanup old typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => {
        const newMap = new Map(prev);
        for (const [id, time] of newMap.entries()) {
          if (now - time > 3000) {
            newMap.delete(id);
          }
        }
        return newMap;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const parseReactions = (reactionsStr?: string) => {
    if (!reactionsStr) return null;
    try {
      const parsed = JSON.parse(reactionsStr);
      return typeof parsed === 'object' && parsed !== null ? parsed : null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    // Fetch users list
    api.get('/users').then((res) => {
      setUsers(res.data);
    }).catch(console.error);

    // Fetch groups
    api.get('/groups').then((res) => {
      setGroups(res.data);
      // Subscribe to all these groups immediately
      res.data.forEach((g: ChatGroup) => {
        wsService.subscribeToGroup(g.id);
      });
    }).catch(console.error);

    // Connect WebSocket
    wsService.connect();
    
    // WebRTC Signaling
    wsService.setOnWebRTC((signal) => {
      if (signal.type === 'offer') {
        setIncomingCall(signal);
      } else if (signal.type === 'answer') {
        webrtcService.handleAnswer(signal);
      } else if (signal.type === 'candidate') {
        webrtcService.handleCandidate(signal);
      } else if (signal.type === 'hangup' || signal.type === 'reject') {
        webrtcService.endCall();
        setActiveCall(null);
        setIncomingCall(null);
      }
    });

    wsService.setOnDisconnect(() => {
      setIsOffline(true);
    });

    wsService.setOnReconnect(async () => {
      setIsOffline(false);
      try {
        const lastMsgId = messages.length > 0 ? Math.max(...messages.map(m => m.id)) : 0;
        const res = await api.get(`/api/v1/sync?after=${lastMsgId}`);
        const syncMessages = res.data;
        
        if (syncMessages && syncMessages.length > 0) {
           if (activeChatRef.current) {
             const currentId = activeChatRef.current.id;
             const affected = syncMessages.some((m: any) => m.senderId === currentId || (m.recipientId === currentId && m.status !== 'GROUP'));
             if (affected) {
               api.get(`/api/v1/conversations/${currentId}/messages`).then(res => setMessages(res.data));
             }
           }
           if (activeGroupRef.current) {
             const currentGroupId = activeGroupRef.current.id;
             const affected = syncMessages.some((m: any) => m.recipientId === currentGroupId && m.status === 'GROUP');
             if (affected) {
               api.get(`/groups/${currentGroupId}/messages`).then(res => setMessages(res.data));
             }
           }
        }
      } catch (err) {
        console.error("Failed to sync offline messages", err);
      }
    });

    webrtcService.setOnSignal((signal) => {
      wsService.sendWebRTCSignal(signal);
    });

    webrtcService.setOnRemoteStream((stream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    });

    // Listen for incoming messages
    wsService.setOnMessage(async (rawMsg: Message) => {
      if (rawMsg.id === -1 && rawMsg.content === 'READ_RECEIPT') {
        setMessages(prev => prev.map(m => 
          (m.recipientId === rawMsg.senderId && m.senderId === currentUser.id && m.status !== 'READ') 
            ? { ...m, status: 'READ' } 
            : m
        ));
        return;
      }

      // Decrypt if necessary
      let msg = rawMsg;
      if (msg.status !== 'GROUP' && msg.content.startsWith('E2EE::')) {
        try {
          const privateKeyStr = localStorage.getItem('e2ee_private_key');
          if (privateKeyStr) {
            const privateKey = await cryptoService.importPrivateKey(JSON.parse(privateKeyStr));
            const peerId = msg.senderId === currentUser.id ? msg.recipientId : msg.senderId;
            const peerPublicKeyStr = msg.senderId === currentUser.id ? 
              (activeChat?.id === peerId ? activeChat.publicKey : null) : 
              (activeChat?.id === peerId ? activeChat.publicKey : null);
              
            // In a real app we'd fetch the peer key if not available, but for now we rely on activeChat
            if (peerPublicKeyStr) {
              const peerPublicKey = await cryptoService.importPublicKey(peerPublicKeyStr);
              const sharedKey = await cryptoService.deriveSharedKey(privateKey, peerPublicKey);
              const plaintext = await cryptoService.decryptMessage(msg.content.substring(6), sharedKey);
              msg = { ...msg, content: plaintext, isE2EE: true };
            } else {
              msg = { ...msg, content: '🔒 [Encrypted Message - Peer Key Missing]', isE2EE: true };
            }
          } else {
            msg = { ...msg, content: '🔒 [Encrypted Message - No Private Key]', isE2EE: true };
          }
        } catch (e) {
          msg = { ...msg, content: '🔒 [Decryption Failed]', isE2EE: true };
        }
      }

      setMessages((prev) => {
        const existingIdx = prev.findIndex(m => m.id === msg.id);
        if (existingIdx !== -1) {
          const newArr = [...prev];
          newArr[existingIdx] = msg;
          return newArr;
        }
        
        // Notification Logic for new messages
        const globalDnd = localStorage.getItem('globalDnd') === 'true';
        const soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
        
        const isGroup = msg.status === 'GROUP';
        const chatId = isGroup ? msg.recipientId : msg.senderId;
        const stateKey = isGroup ? `group_${chatId}` : `user_${chatId}`;
        const isMuted = chatStatesRef.current[stateKey]?.isMuted;

        const isCurrentlyViewing = isGroup ? activeGroupRef.current?.id === chatId : activeChatRef.current?.id === chatId;
        const isSelf = msg.senderId === currentUser.id;

        if (!globalDnd && !isMuted && !isCurrentlyViewing && !isSelf) {
           if (soundEnabled) notificationService.playSound();
           
           const title = msg.senderName || 'NexChat';
           const body = msg.isE2EE ? '🔒 Encrypted message' : (msg.content || 'Sent an attachment');
           
           notificationService.showPushNotification(title, { body });
           setToast({ title, body });
           setTimeout(() => setToast(null), 4000);
        }
        
        if (isCurrentlyViewing && !isSelf && !isGroup) {
           api.post(`/api/v1/conversations/${chatId}/read`).catch(console.error);
        }
        
        return [...prev, msg];
      });
    });

    wsService.setOnPresence((msg: any) => {
      setUsers(prev => prev.map(u => u.id === msg.userId ? { ...u, online: msg.online, lastSeen: msg.lastSeen } : u));
    });

    wsService.setOnTyping((msg: any) => {
      if (msg.senderId !== currentUser.id) {
        setTypingUsers(prev => {
          const newMap = new Map(prev);
          newMap.set(msg.senderId, Date.now());
          return newMap;
        });
      }
    });

    wsService.setOnConnect(() => {
      const lastSync = localStorage.getItem('lastSyncTime') || new Date(Date.now() - 86400000).toISOString();
      api.get(`/sync/messages?since=${lastSync}`).then((res) => {
        const { directMessages, groupMessages } = res.data;
        if (directMessages.length > 0 || groupMessages.length > 0) {
          setMessages(prev => {
            const newMessages = [...prev];
            [...directMessages, ...groupMessages].forEach((m: Message) => {
              if (!newMessages.find(existing => existing.id === m.id)) {
                newMessages.push(m);
              }
            });
            return newMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          });
        }
        localStorage.setItem('lastSyncTime', new Date().toISOString());
      }).catch(console.error);
    });

    // Start message polling as a fallback every 30 seconds
    const pollInterval = setInterval(() => {
      lastSyncTimestampRef.current = new Date().toISOString();
      if (activeChat) {
        api.get(`/api/v1/conversations/${activeChat.id}/messages`).then((res) => {
          setMessages(res.data);
        }).catch(console.error);
      } else if (activeGroup) {
        api.get(`/groups/${activeGroup.id}/messages`).then((res) => {
          setMessages(res.data);
        }).catch(console.error);
      }
    }, 30000);

    return () => {
      clearInterval(pollInterval);
      wsService.disconnect();
    };
  }, []);

  useEffect(() => {
    if (activeChat) {
      api.get(`/conversations/${activeChat.id}/messages`).then(async (res) => {
        const decryptedMessages = await Promise.all(res.data.map(async (msg: Message) => {
          if (msg.status !== 'GROUP' && msg.content.startsWith('E2EE::')) {
            try {
              const privateKeyStr = localStorage.getItem('e2ee_private_key');
              if (privateKeyStr && activeChat.publicKey) {
                const privateKey = await cryptoService.importPrivateKey(JSON.parse(privateKeyStr));
                const peerPublicKey = await cryptoService.importPublicKey(activeChat.publicKey);
                const sharedKey = await cryptoService.deriveSharedKey(privateKey, peerPublicKey);
                const plaintext = await cryptoService.decryptMessage(msg.content.substring(6), sharedKey);
                return { ...msg, content: plaintext, isE2EE: true };
              } else {
                return { ...msg, content: '🔒 [Encrypted Message]', isE2EE: true };
              }
            } catch (e) {
              return { ...msg, content: '🔒 [Decryption Failed]', isE2EE: true };
            }
          }
          return msg;
        }));
        setMessages(decryptedMessages);
      }).catch(console.error);
    }
  }, [activeChat]);

  useEffect(() => {
    if (activeGroup) {
      api.get(`/groups/${activeGroup.id}/messages`).then((res) => {
        setMessages(res.data);
      }).catch(console.error);
    }
  }, [activeGroup]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      setIsSearching(true);
      const timeoutId = setTimeout(() => {
        api.get(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
          .then(res => setSearchResults(res.data))
          .catch(console.error)
          .finally(() => setIsSearching(false));
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults(null);
    }
  }, [searchQuery]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() && !selectedFile) return;

    if (editingMessage) {
      try {
        await api.put(`/messages/${editingMessage.id}`, { content: inputValue.trim() });
        setEditingMessage(null);
        setInputValue('');
      } catch (err) {
        console.error("Edit failed", err);
      }
      return;
    }

    let attachmentUrl = undefined;
    if (selectedFile) {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);
      try {
        const token = localStorage.getItem('token');
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiUrl}/files/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        if (!res.ok) throw new Error("Upload failed with status " + res.status);
        const data = await res.json();
        attachmentUrl = data.url;
      } catch (err) {
        console.error("Upload failed", err);
      }
      setIsUploading(false);
      setSelectedFile(null);
    }

    if (activeChat) {
      let finalContent = inputValue.trim() || ' ';
      try {
        if (activeChat.publicKey) {
          const privateKeyStr = localStorage.getItem('e2ee_private_key');
          if (privateKeyStr) {
            const privateKey = await cryptoService.importPrivateKey(JSON.parse(privateKeyStr));
            const peerPublicKey = await cryptoService.importPublicKey(activeChat.publicKey);
            const sharedKey = await cryptoService.deriveSharedKey(privateKey, peerPublicKey);
            const ciphertext = await cryptoService.encryptMessage(finalContent, sharedKey);
            finalContent = `E2EE::${ciphertext}`;
            // Since we rely on WS sync to show our own messages in a 1-to-1 chat, 
            // the WS receiver will decrypt this if we send it back encrypted.
          }
        }
      } catch (e) {
        console.error("Encryption failed", e);
      }
      wsService.sendMessage(activeChat.id, finalContent, false, attachmentUrl, replyingToMessage?.id, expiresInSeconds || undefined);
    } else if (activeGroup) {
      wsService.sendMessage(activeGroup.id, inputValue.trim() || ' ', true, attachmentUrl, replyingToMessage?.id, expiresInSeconds || undefined);
    }
    
    setInputValue('');
    setReplyingToMessage(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (activeChat) {
      wsService.sendTyping(activeChat.id, false);
    } else if (activeGroup) {
      wsService.sendTyping(activeGroup.id, true);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };
  
  const handleDeleteMessage = async (messageId: number) => {
    try {
      await api.delete(`/messages/${messageId}`);
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const handleReaction = async (messageId: number, emoji: string) => {
    try {
      await api.post(`/messages/${messageId}/react?isGroup=${!!activeGroup}`, { emoji });
    } catch (err) {
      console.error("Failed to react", err);
    }
  };

  const selectUser = (u: User) => {
    setActiveGroup(null);
    setActiveChat(u);
    api.post(`/api/v1/conversations/${u.id}/read`).catch(console.error);
  };

  const selectGroup = (g: ChatGroup) => {
    setActiveChat(null);
    setActiveGroup(g);
  };

  const handleForwardMessage = (recipientId: number, isGroup: boolean) => {
    if (!forwardingMessage) return;
    const content = `[Forwarded] ${forwardingMessage.content}`;
    wsService.sendMessage(recipientId, content, isGroup, forwardingMessage.attachmentUrl);
    setForwardingMessage(null);
    setToast({title: 'Message Forwarded', body: 'Your message has been forwarded successfully.'});
    setTimeout(() => setToast(null), 3000);
  };

  const onGroupCreated = (group: ChatGroup) => {
    setGroups(prev => [...prev, group]);
    wsService.subscribeToGroup(group.id);
    setShowModal(false);
    selectGroup(group);
  };

  const handleStartCall = async (isVideo: boolean) => {
    if (!activeChat) return;
    setActiveCall({ isVideo, recipientId: activeChat.id });
    await webrtcService.startCall(isVideo, activeChat.id);
    
    // Set local stream in UI immediately after starting
    setTimeout(() => {
      if (localVideoRef.current && webrtcService.localStream) {
        localVideoRef.current.srcObject = webrtcService.localStream;
      }
    }, 500);
  };

  const handleAcceptCall = async () => {
    if (!incomingCall) return;
    setActiveCall({ isVideo: incomingCall.isVideo, recipientId: incomingCall.senderId });
    await webrtcService.handleOffer(incomingCall);
    setIncomingCall(null);
    
    setTimeout(() => {
      if (localVideoRef.current && webrtcService.localStream) {
        localVideoRef.current.srcObject = webrtcService.localStream;
      }
    }, 500);
  };

  const handleRejectCall = () => {
    if (!incomingCall) return;
    wsService.sendWebRTCSignal({
      type: 'reject',
      recipientId: incomingCall.senderId
    });
    setIncomingCall(null);
  };

  const handleHangup = () => {
    if (!activeCall) return;
    wsService.sendWebRTCSignal({
      type: 'hangup',
      recipientId: activeCall.recipientId
    });
    webrtcService.endCall();
    setActiveCall(null);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="chat-layout">
      {/* Toast Notification */}
      {toast && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: 'var(--bg-panel)', padding: '1rem 1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '1rem', animation: 'slide-down 0.3s ease' }}>
          <div style={{ background: 'var(--accent-primary)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <Bell size={20} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{toast.title}</h4>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{toast.body.substring(0, 50)}{toast.body.length > 50 ? '...' : ''}</p>
          </div>
          <button onClick={() => setToast(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginLeft: '1rem' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Sidebar */}
      <div className="chat-sidebar glass-panel">
        <div className="sidebar-header">
          <div className="current-user-info" onClick={() => setShowSettings(true)} style={{ cursor: 'pointer' }}>
            <div className="avatar">
              {currentUser.avatarUrl ? (
                <img src={`http://localhost:8080${currentUser.avatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover'}} />
              ) : (
                currentUser.fullName?.[0]?.toUpperCase() || 'U'
              )}
            </div>
            <div className="user-details">
              <span className="user-name">{currentUser.fullName}</span>
              <span className="user-status">{currentUser.statusMessage || 'Online'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Link to="/admin" className="logout-btn" title="Admin Dashboard" style={{ display: 'flex', padding: '0.25rem' }}>
              <Activity size={18} />
            </Link>
            <button className="logout-btn" onClick={() => setShowSettings(true)} title="Settings" style={{ display: 'flex', padding: '0.25rem' }}>
              <Settings size={18} />
            </button>
            <button className="logout-btn" onClick={() => setShowSecurityModal(true)} title="Privacy & Security Center" style={{ display: 'flex', padding: '0.25rem', color: 'var(--accent-primary)' }}>
              <Shield size={18} />
            </button>
            <button className="logout-btn" onClick={() => setShowModal(true)} title="Create Group" style={{ display: 'flex', padding: '0.25rem' }}>
              <Plus size={18} />
            </button>
            <button className="logout-btn" onClick={handleLogout} title="Logout" style={{ display: 'flex', padding: '0.25rem' }}>
              <LogOut size={18} />
            </button>
          </div>
        </div>

        <div style={{ padding: '10px 1.5rem' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search users, groups, messages..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-panel)', color: 'var(--text-primary)', outline: 'none' }}
            />
          </div>
        </div>
        
        <div className="user-list">
          {searchResults ? (
            <div style={{ padding: '0 0.5rem' }}>
              {isSearching && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', margin: '1rem 0' }}>Searching...</div>}
              
              {searchResults.users.length > 0 && (
                <>
                  <div className="user-list-title">USERS</div>
                  {searchResults.users.map(u => (
                    <div key={u.id} className="user-item" onClick={() => selectUser(users.find(x => x.id === u.id) || {id: u.id, email: u.email, fullName: u.name})}>
                      <div className="avatar sm"><UserIcon size={16}/></div>
                      <div className="user-name">{u.name}</div>
                    </div>
                  ))}
                </>
              )}
              
              {searchResults.groups.length > 0 && (
                <>
                  <div className="user-list-title" style={{marginTop: '1rem'}}>GROUPS</div>
                  {searchResults.groups.map(g => (
                    <div key={g.id} className="user-item" onClick={() => selectGroup(groups.find(x => x.id === g.id) || {id: g.id, name: g.name, description: g.description, memberCount: 0})}>
                      <div className="avatar sm group-avatar"><UsersIcon size={16}/></div>
                      <div className="user-name">{g.name}</div>
                    </div>
                  ))}
                </>
              )}
              
              {searchResults.messages.length > 0 && (
                <>
                  <div className="user-list-title" style={{marginTop: '1rem'}}>MESSAGES</div>
                  {searchResults.messages.map(m => (
                    <div key={m.id} className="user-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }} onClick={() => {
                      if (m.type === 'DIRECT') {
                        const targetUser = users.find(x => x.id === m.targetId) || {id: m.targetId, fullName: 'Unknown', email: ''};
                        selectUser(targetUser);
                      } else {
                        const targetGroup = groups.find(x => x.id === m.targetId) || {id: m.targetId, name: 'Group', description: '', memberCount: 0};
                        selectGroup(targetGroup);
                      }
                      setSearchQuery('');
                    }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 'bold' }}>{m.senderName}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{m.content}</div>
                    </div>
                  ))}
                </>
              )}

              {!isSearching && searchResults.users.length === 0 && searchResults.groups.length === 0 && searchResults.messages.length === 0 && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', margin: '2rem 0' }}>No results found</div>
              )}
            </div>
          ) : (
            <>
              <div className="user-list-title">GROUPS</div>
              {groups
                .filter(g => !chatStates[`group_${g.id}`]?.isArchived)
                .sort((a, b) => (chatStates[`group_${b.id}`]?.isPinned ? 1 : 0) - (chatStates[`group_${a.id}`]?.isPinned ? 1 : 0))
                .map(group => (
                <div 
                  key={group.id} 
                  className={`user-item ${activeGroup?.id === group.id ? 'active' : ''}`}
                  onClick={() => selectGroup(group)}
                  style={{ position: 'relative', zIndex: contextMenuUser === -group.id ? 10 : 1 }}
                >
                  <div className="avatar sm group-avatar"><UsersIcon size={16}/></div>
                  <div className="user-name">
                    {group.name}
                    {chatStates[`group_${group.id}`]?.isPinned && <span style={{marginLeft:'4px'}} title="Pinned">📌</span>}
                    {chatStates[`group_${group.id}`]?.isMuted && <span style={{marginLeft:'4px'}} title="Muted">🔇</span>}
                  </div>
                  
                  <button 
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                    onClick={(e) => { e.stopPropagation(); setContextMenuUser(contextMenuUser === -group.id ? null : -group.id); }}
                  >
                    <MoreVertical size={16} />
                  </button>
                  
                  {contextMenuUser === -group.id && (
                    <div style={{ position: 'absolute', right: '10px', top: '40px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', zIndex: 100, padding: '4px', boxShadow: 'var(--glass-shadow)', minWidth: '150px' }}>
                      <button onClick={(e) => { e.stopPropagation(); setContextMenuUser(null); alert('Group Info: ' + group.name + ' (' + group.memberCount + ' members)'); }} style={{ width: '100%', padding: '8px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '4px' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseOut={e => e.currentTarget.style.background = 'none'}>View Group</button>
                      <button onClick={(e) => { e.stopPropagation(); toggleChatState(group.id, true, 'isPinned'); }} style={{ width: '100%', padding: '8px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '4px' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseOut={e => e.currentTarget.style.background = 'none'}>{chatStates[`group_${group.id}`]?.isPinned ? 'Unpin' : 'Pin Group'}</button>
                      <button onClick={(e) => { e.stopPropagation(); toggleChatState(group.id, true, 'isMuted'); }} style={{ width: '100%', padding: '8px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '4px' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseOut={e => e.currentTarget.style.background = 'none'}>{chatStates[`group_${group.id}`]?.isMuted ? 'Unmute' : 'Mute Group'}</button>
                      <button onClick={(e) => { e.stopPropagation(); toggleChatState(group.id, true, 'isArchived'); }} style={{ width: '100%', padding: '8px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '4px' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseOut={e => e.currentTarget.style.background = 'none'}>Archive Group</button>
                      <button onClick={(e) => { e.stopPropagation(); }} style={{ width: '100%', padding: '8px', background: 'none', border: 'none', textAlign: 'left', color: '#ef4444', cursor: 'pointer', borderRadius: '4px' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseOut={e => e.currentTarget.style.background = 'none'}>Leave Group</button>
                    </div>
                  )}
                </div>
              ))}

              <div className="user-list-title" style={{marginTop: '1rem'}}>DIRECT MESSAGES</div>
              {users.filter(u => u.email !== currentUser.email)
                .filter(u => !chatStates[`user_${u.id}`]?.isArchived)
                .sort((a, b) => (chatStates[`user_${b.id}`]?.isPinned ? 1 : 0) - (chatStates[`user_${a.id}`]?.isPinned ? 1 : 0))
                .map(user => (
                <div 
                  key={user.id} 
                  className={`user-item ${activeChat?.id === user.id ? 'active' : ''}`}
                  onClick={() => selectUser(user)}
                  style={{ position: 'relative', zIndex: contextMenuUser === user.id ? 10 : 1 }}
                >
                  <div className="avatar sm">
                    {user.avatarUrl ? <img src={`http://localhost:8080${user.avatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover'}} /> : <UserIcon size={16}/>}
                    <div className={`status-indicator ${user.online ? 'online' : 'offline'}`}></div>
                  </div>
                  <div className="user-name">
                    {user.fullName || user.email}
                    {chatStates[`user_${user.id}`]?.isPinned && <span style={{marginLeft:'4px'}} title="Pinned">📌</span>}
                    {chatStates[`user_${user.id}`]?.isMuted && <span style={{marginLeft:'4px'}} title="Muted">🔇</span>}
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                    {typingUsers.has(user.id.toString()) && <span style={{fontSize: '0.7rem', color: 'var(--accent-primary)', marginRight: '8px'}}>typing...</span>}
                    <button 
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                      onClick={(e) => { e.stopPropagation(); setContextMenuUser(contextMenuUser === user.id ? null : user.id); }}
                    >
                      <MoreVertical size={16} />
                    </button>
                  </div>
                  
                  {contextMenuUser === user.id && (
                    <div style={{ position: 'absolute', right: '10px', top: '40px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', zIndex: 100, padding: '4px', boxShadow: 'var(--glass-shadow)', minWidth: '150px' }}>
                      <button onClick={(e) => { e.stopPropagation(); setContextMenuUser(null); setShowProfileModal(user); }} style={{ width: '100%', padding: '8px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '4px' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseOut={e => e.currentTarget.style.background = 'none'}>View Profile</button>
                      <button onClick={(e) => { e.stopPropagation(); toggleChatState(user.id, false, 'isPinned'); }} style={{ width: '100%', padding: '8px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '4px' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseOut={e => e.currentTarget.style.background = 'none'}>{chatStates[`user_${user.id}`]?.isPinned ? 'Unpin' : 'Pin Chat'}</button>
                      <button onClick={(e) => { e.stopPropagation(); toggleChatState(user.id, false, 'isMuted'); }} style={{ width: '100%', padding: '8px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '4px' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseOut={e => e.currentTarget.style.background = 'none'}>{chatStates[`user_${user.id}`]?.isMuted ? 'Unmute' : 'Mute Chat'}</button>
                      <button onClick={(e) => { e.stopPropagation(); toggleChatState(user.id, false, 'isArchived'); }} style={{ width: '100%', padding: '8px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '4px' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseOut={e => e.currentTarget.style.background = 'none'}>Archive Chat</button>
                      <button onClick={async (e) => { 
                        e.stopPropagation(); setContextMenuUser(null);
                        try {
                          if (user.isBlocked) await api.post(`/users/${user.id}/unblock`);
                          else await api.post(`/users/${user.id}/block`);
                          setUsers(users.map(u => u.id === user.id ? {...u, isBlocked: !u.isBlocked} : u));
                          if (activeChat?.id === user.id) setActiveChat({...activeChat, isBlocked: !user.isBlocked});
                        } catch(err) { console.error(err); }
                      }} style={{ width: '100%', padding: '8px', background: 'none', border: 'none', textAlign: 'left', color: user.isBlocked ? 'var(--success-color)' : '#ef4444', cursor: 'pointer', borderRadius: '4px' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseOut={e => e.currentTarget.style.background = 'none'}>{user.isBlocked ? 'Unblock User' : 'Block User'}</button>
                      <button onClick={(e) => { e.stopPropagation(); setContextMenuUser(null); if(activeChat?.id === user.id) setActiveChat(null); }} style={{ width: '100%', padding: '8px', background: 'none', border: 'none', textAlign: 'left', color: '#ef4444', cursor: 'pointer', borderRadius: '4px' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseOut={e => e.currentTarget.style.background = 'none'}>Close Chat</button>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="chat-main glass-panel" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} style={{position: 'relative'}}>
        {isDragging && (
          <div style={{position: 'absolute', inset: 0, background: 'rgba(99, 102, 241, 0.2)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed var(--accent-primary)', borderRadius: '16px', backdropFilter: 'blur(2px)'}}>
            <h2 style={{color: 'var(--text-primary)', pointerEvents: 'none', background: 'var(--accent-primary)', padding: '1rem 2rem', borderRadius: '30px', boxShadow: 'var(--glass-shadow)'}}>Drop file to send</h2>
          </div>
        )}
        {(activeChat || activeGroup) ? (
          <>
            <div className="chat-header">
              <div className={`avatar sm ${activeGroup ? 'group-avatar' : ''}`}>
                {activeGroup ? <UsersIcon size={16}/> : (activeChat?.avatarUrl ? <img src={`http://localhost:8080${activeChat.avatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover'}} /> : <UserIcon size={16}/>)}
              </div>
              <div className="active-chat-name" onClick={() => activeGroup ? setShowGroupDetails(true) : (activeChat && setShowProfileModal(activeChat))} style={{cursor: 'pointer', display: 'flex', flexDirection: 'column'}}>
                <div style={{ fontWeight: '600', fontSize: '1.05rem', display: 'flex', alignItems: 'center' }}>
                  {activeGroup ? activeGroup.name : activeChat?.fullName}
                  {!activeGroup && activeChat?.publicKey && (
                    <span title="End-to-End Encrypted" style={{fontSize: '0.75rem', color: 'var(--success-color)', marginLeft: '8px', display: 'flex', alignItems: 'center', gap: '4px'}}>
                      🔒 E2EE
                    </span>
                  )}
                </div>
                {activeGroup && (
                  <div style={{fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px'}}>
                    {activeGroup.description ? `${activeGroup.description} • ` : ''}{activeGroup.memberCount} members
                  </div>
                )}
                {!activeGroup && activeChat && (
                  <div style={{fontSize: '0.75rem', color: activeChat.online ? 'var(--success-color)' : 'var(--text-muted)', marginTop: '2px'}}>
                    {typingUsers.has(activeChat.id.toString()) ? 'typing...' : activeChat.online ? 'Online' : (activeChat.lastSeen ? `Last seen ${new Date(activeChat.lastSeen).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : 'Offline')}
                  </div>
                )}
                {activeGroup && Array.from(typingUsers.keys()).length > 0 && (
                  <div style={{fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 'normal'}}>
                    Someone is typing...
                  </div>
                )}
                {activeGroup && Array.from(typingUsers.keys()).length > 0 && (
                  <div style={{fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 'normal'}}>
                    Someone is typing...
                  </div>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', alignItems: 'center' }}>
                {isOffline && <span title="Offline"><AlertTriangle size={18} color="var(--error-color)" /></span>}
                <button 
                  onClick={toggleTheme} 
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: theme === 'light' ? '#f59e0b' : 'var(--text-primary)', padding: '6px', borderRadius: '50%', cursor: 'pointer', display: 'flex' }}
                  title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                  {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
                </button>

                {!activeGroup && activeChat && (
                  <>
                    <button 
                      onClick={() => {
                        if (window.confirm('Are you sure you want to clear all messages? This cannot be undone.')) {
                          api.delete(`/api/v1/conversations/${activeChat.id}/messages`)
                            .then(() => setMessages([]))
                            .catch(err => console.error("Failed to clear chat", err));
                        }
                      }}
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: '#ef4444', padding: '6px', borderRadius: '50%', cursor: 'pointer', display: 'flex' }}
                      title="Clear Chat History"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleStartCall(false)}
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '6px', borderRadius: '50%', cursor: 'pointer', display: 'flex' }}
                      title="Audio Call"
                    >
                      <Phone size={16} />
                    </button>
                    <button 
                      onClick={() => handleStartCall(true)}
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '6px', borderRadius: '50%', cursor: 'pointer', display: 'flex' }}
                      title="Video Call"
                    >
                      <Video size={16} />
                    </button>
                    <button 
                      onClick={toggleBlockUser}
                      style={{ background: 'transparent', border: `1px solid ${activeChat.isBlocked ? 'var(--success-color)' : '#ef4444'}`, color: activeChat.isBlocked ? 'var(--success-color)' : '#ef4444', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', marginLeft: '8px' }}
                    >
                      {activeChat.isBlocked ? 'Unblock' : 'Block User'}
                    </button>
                  </>
                )}
              </div>
            </div>
            
            <div className="chat-messages" onClick={() => setHoveredMessageId(null)}>
              {messages
                .filter(msg => {
                  // Filter out messages not meant for the current active view (since all come through same callback initially)
                  if (activeChat) {
                     return msg.status !== 'GROUP' && (msg.senderId == activeChat.id || msg.recipientId == activeChat.id);
                  }
                  if (activeGroup) {
                     return msg.status === 'GROUP' && msg.recipientId == activeGroup.id;
                  }
                  return false;
                })
                .map((msg, idx) => {
                const isMine = msg.senderId === currentUser.id;
                return (
                  <div 
                    id={`message-${msg.id}`}
                    key={msg.id || idx} 
                    className={`message-wrapper ${isMine ? 'mine' : 'theirs'}`}
                    onClick={(e) => { e.stopPropagation(); setHoveredMessageId(hoveredMessageId === msg.id ? null : msg.id); }}
                    style={{ transition: 'background 0.5s ease', borderRadius: '8px', padding: '2px 8px', display: 'flex', gap: '8px', alignItems: 'flex-end', flexDirection: isMine ? 'row-reverse' : 'row' }}
                  >
                    {!isMine && (
                      <div className="avatar sm" style={{ width: '28px', height: '28px', flexShrink: 0, overflow: 'hidden', cursor: 'pointer' }} onClick={() => {
                        const senderUser = users.find(u => u.id === msg.senderId);
                        if (senderUser) {
                          setShowProfileModal(senderUser);
                        }
                      }}>
                        {users.find(u => u.id === msg.senderId)?.avatarUrl ? (
                           <img src={`http://localhost:8080${users.find(u => u.id === msg.senderId)?.avatarUrl}`} alt="" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                        ) : (
                           (msg.senderName?.[0] || 'U').toUpperCase()
                        )}
                      </div>
                    )}
                    <div className="message-bubble" style={{ position: 'relative', maxWidth: '85%' }}>
                      {hoveredMessageId === msg.id && !msg.isDeleted && (
                        <div style={{ position: 'absolute', top: '-10px', right: isMine ? '0' : 'auto', left: isMine ? 'auto' : '0', background: 'var(--bg-panel)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', gap: '8px', zIndex: 10 }}>
                          <button onClick={() => {
                            navigator.clipboard.writeText(msg.content);
                            setToast({title: 'Copied', body: 'Message copied to clipboard'});
                            setTimeout(() => setToast(null), 2000);
                          }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem' }}>Copy</button>
                          <button onClick={() => setForwardingMessage(msg)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem' }}>Forward</button>
                          <button onClick={() => setReplyingToMessage(msg)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem' }}>Reply</button>
                          {['👍', '❤️', '😂', '😮', '😢', '👏'].map(emoji => (
                             <button key={emoji} onClick={() => handleReaction(msg.id, emoji)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>{emoji}</button>
                          ))}
                          {isMine && <button onClick={() => { setEditingMessage(msg); setInputValue(msg.content); }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem' }}>Edit</button>}
                          {isMine && <button onClick={() => handleDeleteMessage(msg.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem' }}>Delete</button>}
                        </div>
                      )}
                      
                      {msg.replyToMessageId && (
                        <div 
                          style={{ background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px', marginBottom: '8px', borderLeft: '3px solid var(--accent-primary)', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}
                          onClick={() => {
                            const el = document.getElementById(`message-${msg.replyToMessageId}`);
                            if (el) {
                              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              el.style.background = 'rgba(99, 102, 241, 0.2)';
                              setTimeout(() => el.style.background = 'transparent', 2000);
                            }
                          }}
                        >
                           {messages.find(m => m.id === msg.replyToMessageId)?.content?.substring(0, 50) || 'Replying to message...'}
                        </div>
                      )}

                      {activeGroup && !isMine && (
                        <div style={{fontSize: '0.7rem', color: 'var(--accent-primary)', marginBottom: '4px', fontWeight: 'bold'}}>
                          {msg.senderName}
                        </div>
                      )}
                      {msg.attachmentUrl && (
                        <div style={{marginBottom: '0.5rem'}}>
                          {msg.attachmentUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                            <img src={`http://localhost:8080${msg.attachmentUrl}`} alt="attachment" style={{maxWidth: '100%', borderRadius: '8px', maxHeight: '250px', cursor: 'pointer'}} onClick={() => window.open(`http://localhost:8080${msg.attachmentUrl}`, '_blank')} />
                          ) : msg.attachmentUrl.match(/\.(mp4|webm|ogg)$/i) ? (
                            <video src={`http://localhost:8080${msg.attachmentUrl}`} controls style={{maxWidth: '100%', borderRadius: '8px', maxHeight: '250px'}} />
                          ) : msg.attachmentUrl.match(/\.(pdf)$/i) ? (
                            <iframe src={`http://localhost:8080${msg.attachmentUrl}`} style={{width: '100%', height: '300px', border: 'none', borderRadius: '8px'}} title="PDF Document" />
                          ) : (
                            <a href={`http://localhost:8080${msg.attachmentUrl}`} target="_blank" rel="noreferrer" style={{display: 'flex', alignItems: 'center', gap: '4px', color: 'inherit', textDecoration: 'underline'}}>
                              <File size={16} /> Download File
                            </a>
                          )}
                        </div>
                      )}
                      {msg.content}
                      
                      {/* Reactions Row */}
                      {(() => {
                        const reactionsObj = parseReactions(msg.reactions);
                        return reactionsObj && Object.keys(reactionsObj).length > 0 ? (
                          <div className="message-reactions">
                            {Object.entries(reactionsObj).map(([emoji, userIds]: [string, any]) => (
                              <span key={emoji} className={`reaction-badge ${userIds.includes(currentUser?.id || 0) ? 'reacted' : ''}`} onClick={() => handleReaction(msg.id, emoji)}>
                                {emoji} {userIds.length}
                              </span>
                            ))}
                          </div>
                        ) : null;
                      })()}
                      
                      {/* Hover Actions (Dynamic Reactions & Forward) */}
                      <div className="message-hover-actions">
                         <div className="hover-action-btn" onClick={() => handleReaction(msg.id, '👍')} title="React 👍">👍</div>
                         <div className="hover-action-btn" onClick={() => handleReaction(msg.id, '❤️')} title="React ❤️">❤️</div>
                         <div className="hover-action-btn" onClick={() => handleReaction(msg.id, '😂')} title="React 😂">😂</div>
                         <div className="hover-action-btn" onClick={() => setForwardingMessage(msg)} title="Forward">
                           <Forward size={14} />
                         </div>
                         <div className="hover-action-btn" onClick={() => setReplyingToMessage(msg)} title="Reply">
                           <Reply size={14} />
                         </div>
                      </div>
                      
                      {/* AI Insights */}
                      {(msg.sentiment || (msg.spamScore !== undefined && msg.spamScore > 0.5)) && (
                        <div style={{
                          marginTop: '6px', 
                          paddingTop: '6px', 
                          borderTop: '1px solid rgba(255,255,255,0.1)', 
                          fontSize: '0.7rem', 
                          display: 'flex', 
                          gap: '8px',
                          alignItems: 'center'
                        }}>
                          {msg.sentiment === 'POSITIVE' && <span title="Positive Sentiment">🟢 Positive</span>}
                          {msg.sentiment === 'NEGATIVE' && <span title="Negative Sentiment">🔴 Negative</span>}
                          
                          {msg.spamScore !== undefined && msg.spamScore > 0.5 && (
                            <span style={{color: '#ef4444', fontWeight: 'bold'}} title={`Spam Probability: ${(msg.spamScore * 100).toFixed(0)}%`}>
                              ⚠️ Suspicious ({(msg.spamScore * 100).toFixed(0)}%)
                            </span>
                          )}
                        </div>
                      )}

                      <span className="message-time">
                        {msg.isE2EE && <span style={{marginRight: '4px', color: 'var(--success-color)'}} title="End-to-End Encrypted">🔒</span>}
                        {msg.expiresAt && <span style={{marginRight: '4px', color: '#ef4444'}} title={`Expires at ${new Date(msg.expiresAt).toLocaleTimeString()}`}>⏱️</span>}
                        {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        {msg.isEdited && <span style={{marginLeft: '4px', fontStyle: 'italic', fontSize: '0.65rem'}}>(edited)</span>}
                        {isMine && msg.status !== 'GROUP' && (
                          <span className="message-status" style={{ color: msg.status === 'READ' ? 'var(--accent-primary)' : 'inherit', marginLeft: '4px' }}>
                            {msg.status === 'READ' ? '✓✓' : '✓'}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            
            {selectedFile && (
              <div className="attachment-preview" style={{padding: '0.5rem 1.5rem', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                  <Paperclip size={14} />
                  <span>{selectedFile.name}</span>
                </div>
                <button onClick={() => setSelectedFile(null)} style={{background: 'none', border: 'none', color: 'inherit', cursor: 'pointer'}}>
                  <X size={14} />
                </button>
              </div>
            )}

            {replyingToMessage && (
              <div style={{padding: '0.5rem 1.5rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', borderTop: '1px solid var(--border-color)'}}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: '600', color: 'var(--accent-primary)', marginBottom: '2px' }}>Replying to</span>
                  <span>{replyingToMessage.content.substring(0, 50)}...</span>
                </div>
                <button onClick={() => setReplyingToMessage(null)} style={{background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px'}}>
                  <X size={16} />
                </button>
              </div>
            )}
            
            {editingMessage && (
              <div style={{padding: '0.5rem 1.5rem', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem'}}>
                <div>Editing message...</div>
                <button onClick={() => { setEditingMessage(null); setInputValue(''); }} style={{background: 'none', border: 'none', color: 'inherit', cursor: 'pointer'}}>
                  <X size={14} />
                </button>
              </div>
            )}

            <form className="chat-input-area" onSubmit={handleSend}>
              <label className="attachment-btn" style={{cursor: 'pointer', color: 'var(--text-secondary)'}}>
                <Paperclip size={20} />
                <input type="file" style={{display: 'none'}} onChange={handleFileSelect} />
              </label>
              <select 
                value={expiresInSeconds || ''} 
                onChange={(e) => setExpiresInSeconds(e.target.value ? Number(e.target.value) : null)}
                style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem', outline: 'none', cursor: 'pointer', fontSize: '0.8rem' }}
                title="Disappearing Message Timer"
                className="disappearing-select"
              >
                <option value="" style={{ color: '#000', background: '#fff' }}>Off</option>
                <option value="3600" style={{ color: '#000', background: '#fff' }}>1 Hour</option>
                <option value="86400" style={{ color: '#000', background: '#fff' }}>24 Hours</option>
                <option value="604800" style={{ color: '#000', background: '#fff' }}>7 Days</option>
              </select>
              <input 
                type="text" 
                placeholder={isUploading ? "Uploading..." : (activeChat?.isBlocked ? "You blocked this user" : "Type a message...")} 
                className="chat-input"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (inputValue.trim() || selectedFile) {
                      handleSend(e as any);
                    }
                  }
                }}
                disabled={isUploading || activeChat?.isBlocked}
              />
              <button type="submit" className="send-btn" disabled={(!inputValue.trim() && !selectedFile) || isUploading || activeChat?.isBlocked}>
                <Send size={18} />
              </button>
            </form>
          </>
        ) : (
          <div className="no-chat-selected">
            <div className="no-chat-icon"><Send size={48} /></div>
            <h2>Select a conversation</h2>
            <p>Choose a user or group from the sidebar to start chatting</p>
          </div>
        )}
      </div>
      
      {showModal && (
        <CreateGroupModal 
          users={users} 
          onClose={() => setShowModal(false)} 
          onGroupCreated={onGroupCreated} 
        />
      )}

      {showSettings && (
        <SettingsModal 
          user={currentUser}
          onClose={() => setShowSettings(false)}
          onSave={(updatedUser) => {
            setCurrentUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
          }}
        />
      )}

      {showSecurityModal && <SecurityCenterModal onClose={() => setShowSecurityModal(false)} onLogout={() => { localStorage.clear(); window.location.href = '/login'; }} />}
      
      {showGroupDetails && activeGroup && (
        <GroupDetailsModal
          group={activeGroup}
          allUsers={users}
          onClose={() => setShowGroupDetails(false)}
          onMembersAdded={() => {
            api.get('/groups').then(res => setGroups(res.data));
          }}
        />
      )}
      
      {showProfileModal && (
        <UserProfileModal
          user={showProfileModal}
          onClose={() => setShowProfileModal(null)}
          onBlockToggle={(u) => { setActiveChat(u); toggleBlockUser(); }}
        />
      )}

      {forwardingMessage && (
        <ForwardMessageModal
          messageContent={forwardingMessage.content}
          attachmentUrl={forwardingMessage.attachmentUrl}
          users={users}
          groups={groups}
          onClose={() => setForwardingMessage(null)}
          onForward={handleForwardMessage}
        />
      )}

      {/* WebRTC Modals */}
      {incomingCall && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000, background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '300px', animation: 'slide-in-right 0.3s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="avatar" style={{ width: '48px', height: '48px' }}>
              {users.find(u => u.id === incomingCall.senderId)?.avatarUrl ? (
                <img src={`http://localhost:8080${users.find(u => u.id === incomingCall.senderId)?.avatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover'}} />
              ) : (
                <UserIcon size={24} />
              )}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Incoming {incomingCall.isVideo ? 'Video' : 'Audio'} Call</h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>from {users.find(u => u.id === incomingCall.senderId)?.fullName || 'Unknown'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <button onClick={handleRejectCall} style={{ flex: 1, padding: '0.75rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}>
              <PhoneMissed size={18} /> Decline
            </button>
            <button onClick={handleAcceptCall} style={{ flex: 1, padding: '0.75rem', background: 'var(--success-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}>
              {incomingCall.isVideo ? <Video size={18} /> : <Phone size={18} />} Accept
            </button>
          </div>
        </div>
      )}

      {activeCall && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: '900px', position: 'relative', display: 'flex', gap: '1rem', padding: '2rem', justifyContent: 'center' }}>
            
            {/* Remote Video (Main) */}
            <div style={{ flex: 1, background: '#000', borderRadius: '16px', overflow: 'hidden', position: 'relative', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
              <video 
                ref={remoteVideoRef} 
                autoPlay 
                playsInline 
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: webrtcService.remoteStream ? 'block' : 'none' }}
              />
              {!webrtcService.remoteStream && (
                <div style={{ color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  <Loader2 size={32} className="animate-spin" />
                  <span>Connecting...</span>
                </div>
              )}
              <div style={{ position: 'absolute', bottom: '16px', left: '16px', background: 'rgba(0,0,0,0.5)', padding: '4px 12px', borderRadius: '20px', color: 'white', fontSize: '0.9rem' }}>
                {users.find(u => u.id === activeCall.recipientId)?.fullName || 'Remote Peer'}
              </div>
            </div>

            {/* Local Video (PIP) */}
            <div style={{ position: 'absolute', top: '2rem', right: '2rem', width: '200px', height: '150px', background: '#222', borderRadius: '12px', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
              <video 
                ref={localVideoRef} 
                autoPlay 
                playsInline 
                muted 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              {isVideoDisabled && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#222' }}>
                  <VideoOff size={32} color="var(--text-muted)" />
                </div>
              )}
            </div>

          </div>

          {/* Call Controls */}
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '2rem', background: 'rgba(255,255,255,0.1)', padding: '1rem 2rem', borderRadius: '40px' }}>
            <button 
              onClick={() => { setIsMuted(webrtcService.toggleMute()); }}
              style={{ width: '56px', height: '56px', borderRadius: '50%', border: 'none', background: isMuted ? 'var(--bg-tertiary)' : 'rgba(255,255,255,0.2)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
            >
              {isMuted ? <MicOff size={24} color="#ef4444" /> : <Mic size={24} />}
            </button>
            <button 
              onClick={() => { setIsVideoDisabled(webrtcService.toggleVideo()); }}
              style={{ width: '56px', height: '56px', borderRadius: '50%', border: 'none', background: isVideoDisabled ? 'var(--bg-tertiary)' : 'rgba(255,255,255,0.2)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
            >
              {isVideoDisabled ? <VideoOff size={24} color="#ef4444" /> : <Video size={24} />}
            </button>
            <button 
              onClick={handleHangup}
              style={{ width: '72px', height: '56px', borderRadius: '28px', border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s', padding: '0 24px' }}
            >
              <PhoneMissed size={24} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
