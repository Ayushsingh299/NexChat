import { X, User, Mail, Clock, ShieldAlert } from 'lucide-react';

interface UserProfileModalProps {
  user: {
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
  };
  onClose: () => void;
  onBlockToggle: (user: any) => void;
}

export default function UserProfileModal({ user, onClose, onBlockToggle }: UserProfileModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>User Profile</h2>
          <button onClick={onClose} className="close-btn" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginTop: '2rem' }}>
          <div className="avatar" style={{ width: '100px', height: '100px', fontSize: '2.5rem', background: 'var(--bg-tertiary)', border: '2px solid var(--border-color)' }}>
            {user.avatarUrl ? (
              <img src={`http://localhost:8080${user.avatarUrl}`} alt="Avatar" style={{width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover'}} />
            ) : (
              <User size={48} color="var(--text-muted)" />
            )}
          </div>
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)' }}>{user.fullName || user.email}</h3>
            {user.statusMessage && (
              <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                "{user.statusMessage}"
              </p>
            )}
            <div style={{ color: user.online ? 'var(--success-color)' : 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
              {user.online ? 'Online' : (user.lastSeen ? `Last seen ${new Date(user.lastSeen).toLocaleString()}` : 'Offline')}
            </div>
          </div>
        </div>

        {user.bio && (
          <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>About</h4>
            <p style={{ margin: 0, color: 'var(--text-primary)', lineHeight: 1.5 }}>{user.bio}</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
            <Mail size={18} color="var(--accent-primary)" />
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Email</div>
              <div style={{ color: 'var(--text-primary)' }}>{user.email}</div>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
            <Clock size={18} color="var(--accent-primary)" />
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status</div>
              <div style={{ color: 'var(--text-primary)' }}>{user.bio || 'Available'}</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            className="btn" 
            style={{ 
              flex: 1, 
              background: user.isBlocked ? 'var(--bg-tertiary)' : 'rgba(239, 68, 68, 0.1)', 
              color: user.isBlocked ? 'var(--text-primary)' : 'var(--error-color)',
              border: `1px solid ${user.isBlocked ? 'var(--border-color)' : 'rgba(239, 68, 68, 0.2)'}`
            }}
            onClick={() => {
              onBlockToggle(user);
              onClose();
            }}
          >
            <ShieldAlert size={18} />
            {user.isBlocked ? 'Unblock User' : 'Block User'}
          </button>
        </div>
      </div>
    </div>
  );
}
