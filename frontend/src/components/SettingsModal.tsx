import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Loader2, User as UserIcon, Bell, Download } from 'lucide-react';
import api from '../services/api';
import { notificationService } from '../services/notificationService';

interface UserProfile {
  id: number;
  email: string;
  fullName: string;
  bio?: string;
  statusMessage?: string;
  avatarUrl?: string;
  showLastSeen?: boolean;
  showOnlineStatus?: boolean;
  readReceiptsEnabled?: boolean;
}

interface SettingsModalProps {
  user: UserProfile;
  onClose: () => void;
  onSave: (updatedUser: UserProfile) => void;
}

export default function SettingsModal({ user, onClose, onSave }: SettingsModalProps) {
  const [fullName, setFullName] = useState(user.fullName || '');
  const [bio, setBio] = useState(user.bio || '');
  const [statusMessage, setStatusMessage] = useState(user.statusMessage || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
  
  const [showLastSeen, setShowLastSeen] = useState(user.showLastSeen ?? true);
  const [showOnlineStatus, setShowOnlineStatus] = useState(user.showOnlineStatus ?? true);
  const [readReceiptsEnabled, setReadReceiptsEnabled] = useState(user.readReceiptsEnabled ?? true);
  
  // Notification States
  const [globalDnd, setGlobalDnd] = useState(localStorage.getItem('globalDnd') === 'true');
  const [pushEnabled, setPushEnabled] = useState(localStorage.getItem('pushEnabled') === 'true');
  const [soundEnabled, setSoundEnabled] = useState(localStorage.getItem('soundEnabled') !== 'false');
  
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      setDeferredPrompt(null);
    } else {
      alert("Installation is not supported by your browser, or NexChat is already installed.");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', e.target.files[0]);
      
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
        setAvatarUrl(data.url);
      } catch (err) {
        console.error("Avatar upload failed", err);
        alert("Failed to upload image. Make sure MinIO/Docker is running if you haven't enabled local fallback.");
      }
      setIsUploading(false);
    }
  };

  const handlePushToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    if (checked) {
      const granted = await notificationService.requestPermission();
      setPushEnabled(granted);
    } else {
      setPushEnabled(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await api.put('/users/profile', {
        fullName,
        bio,
        statusMessage,
        avatarUrl
      });
      
      await api.put('/users/privacy', {
        showLastSeen,
        showOnlineStatus,
        readReceiptsEnabled
      });
      
      localStorage.setItem('globalDnd', String(globalDnd));
      localStorage.setItem('pushEnabled', String(pushEnabled));
      localStorage.setItem('soundEnabled', String(soundEnabled));
      
      onSave({ ...res.data, showLastSeen, showOnlineStatus, readReceiptsEnabled });
      onClose();
    } catch (err) {
      console.error("Failed to update profile", err);
      alert("Failed to save profile changes.");
    }
    setIsSaving(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel" style={{ maxWidth: '500px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', animation: 'slide-up 0.3s ease' }}>
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <h2>Profile Settings</h2>
          <button onClick={onClose} className="close-btn" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1.5rem', overflowY: 'auto', paddingRight: '0.5rem', flex: 1 }}>
          
          {/* Avatar Section */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div 
              style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'var(--bg-tertiary)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '2px solid var(--border-color)', cursor: 'pointer' }}
              onClick={() => fileInputRef.current?.click()}
            >
              {avatarUrl ? (
                <img src={`http://localhost:8080${avatarUrl}`} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <UserIcon size={48} color="var(--text-muted)" />
              )}
              
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s', ':hover': { opacity: 1 } } as any} className="avatar-overlay">
                {isUploading ? <Loader2 className="animate-spin" color="white" /> : <Camera color="white" />}
              </div>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Click to change avatar</span>
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleFileChange} 
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Full Name</label>
            <input 
              type="text" 
              className="chat-input"
              value={fullName} 
              onChange={e => setFullName(e.target.value)} 
              required
              style={{ borderRadius: '8px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Status Message</label>
            <input 
              type="text" 
              className="chat-input"
              value={statusMessage} 
              onChange={e => setStatusMessage(e.target.value)} 
              maxLength={50}
              style={{ borderRadius: '8px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Bio</label>
            <textarea 
              className="chat-input"
              placeholder="Tell everyone a little about yourself..."
              value={bio} 
              onChange={e => setBio(e.target.value)} 
              rows={3}
              maxLength={200}
              style={{ borderRadius: '8px', resize: 'none', fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>Privacy</h3>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={showOnlineStatus} onChange={e => setShowOnlineStatus(e.target.checked)} />
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Show Online Status</span>
            </label>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={showLastSeen} onChange={e => setShowLastSeen(e.target.checked)} />
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Show Last Seen</span>
            </label>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={readReceiptsEnabled} onChange={e => setReadReceiptsEnabled(e.target.checked)} />
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Send Read Receipts</span>
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Bell size={16} /> Notifications</h3>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={globalDnd} onChange={e => setGlobalDnd(e.target.checked)} />
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Do Not Disturb (Mute all)</span>
            </label>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={pushEnabled} onChange={handlePushToggle} />
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Browser Push Notifications</span>
            </label>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={soundEnabled} onChange={e => setSoundEnabled(e.target.checked)} />
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Notification Sounds</span>
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Download size={16} /> Install App</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>Install NexChat on your device for a faster, native app experience.</p>
            <button 
              type="button" 
              onClick={handleInstallClick}
              style={{ background: 'var(--accent-primary)', border: 'none', color: 'white', padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}
            >
              Install NexChat
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem', paddingBottom: '1rem' }}>
            <button 
              type="button" 
              onClick={onClose} 
              style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isUploading || isSaving}
              style={{ background: 'var(--accent-primary)', border: 'none', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {isSaving && <Loader2 size={16} className="animate-spin" />} Save Changes
            </button>
          </div>
        </form>
      </div>
      <style>{`
        .avatar-overlay:hover {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}
