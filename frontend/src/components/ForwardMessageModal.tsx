import { useState } from 'react';
import { X, Search, Send, Users } from 'lucide-react';

interface ForwardMessageModalProps {
  messageContent: string;
  attachmentUrl?: string;
  users: any[];
  groups: any[];
  onClose: () => void;
  onForward: (recipientId: number, isGroup: boolean) => void;
}

export default function ForwardMessageModal({ messageContent, attachmentUrl, users, groups, onClose, onForward }: ForwardMessageModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredUsers = users.filter(u => u.email.toLowerCase().includes(searchTerm.toLowerCase()) || (u.fullName && u.fullName.toLowerCase().includes(searchTerm.toLowerCase())));
  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
        <div className="modal-header" style={{ marginBottom: '1rem' }}>
          <h3>Forward Message</h3>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>
        
        <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          {attachmentUrl ? <span style={{ display: 'block', marginBottom: '4px' }}>📎 [Attachment]</span> : null}
          <div style={{ fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {messageContent}
          </div>
        </div>

        <div style={{ position: 'relative', marginBottom: '1rem' }}>
          <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search users or groups..." 
            className="form-input" 
            style={{ paddingLeft: '36px' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filteredGroups.length > 0 && (
            <>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '0.5rem', paddingLeft: '0.5rem' }}>Groups</div>
              {filteredGroups.map(g => (
                <div key={`g-${g.id}`} 
                     style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.2s' }}
                     onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                     onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                     onClick={() => onForward(g.id, true)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="avatar sm" style={{ background: 'var(--accent-primary)' }}><Users size={16} color="white" /></div>
                    <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{g.name}</span>
                  </div>
                  <Send size={16} color="var(--accent-primary)" />
                </div>
              ))}
            </>
          )}

          {filteredUsers.length > 0 && (
            <>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '0.5rem', paddingLeft: '0.5rem' }}>Contacts</div>
              {filteredUsers.map(u => (
                <div key={`u-${u.id}`} 
                     style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.2s' }}
                     onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                     onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                     onClick={() => onForward(u.id, false)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="avatar sm">{u.fullName?.[0]?.toUpperCase() || 'U'}</div>
                    <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{u.fullName || u.email}</span>
                  </div>
                  <Send size={16} color="var(--accent-primary)" />
                </div>
              ))}
            </>
          )}

          {filteredGroups.length === 0 && filteredUsers.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              No matches found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
