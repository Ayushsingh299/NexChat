import { useState, useEffect } from 'react';
import { X, Users, UserPlus, Link as LinkIcon, LogOut, Shield } from 'lucide-react';
import api from '../services/api';

interface User {
  id: number;
  email: string;
  fullName: string;
  avatarUrl?: string;
}

interface Group {
  id: number;
  name: string;
  description: string;
  memberCount: number;
}

interface Props {
  group: Group;
  allUsers: User[];
  onClose: () => void;
  onMembersAdded: () => void;
}

export default function GroupDetailsModal({ group, allUsers, onClose, onMembersAdded }: Props) {
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedNewMembers, setSelectedNewMembers] = useState<number[]>([]);

  useEffect(() => {
    api.get(`/groups/${group.id}/members`)
      .then(res => setMemberIds(res.data))
      .catch(console.error);
  }, [group.id]);

  const currentMembers = allUsers.filter(u => memberIds.includes(u.id));
  const nonMembers = allUsers.filter(u => !memberIds.includes(u.id));

  const handleAddMembers = async () => {
    if (selectedNewMembers.length === 0) return;
    try {
      await api.post(`/groups/${group.id}/members`, { memberIds: selectedNewMembers });
      onMembersAdded();
      setIsAdding(false);
      setSelectedNewMembers([]);
      // Refresh member list
      const res = await api.get(`/groups/${group.id}/members`);
      setMemberIds(res.data);
    } catch (err) {
      console.error(err);
      alert('Failed to add members');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel animate-slide-up" style={{ maxWidth: '400px', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
        <div className="modal-header" style={{ marginBottom: '1rem' }}>
          <h3><Users size={18} style={{marginRight: '8px', verticalAlign: 'middle'}}/> Group Info</h3>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>
        
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div className="avatar" style={{ width: '80px', height: '80px', margin: '0 auto 1rem', background: 'var(--accent-primary)', fontSize: '2rem' }}>
            <Users size={40} color="white" />
          </div>
          <h2 style={{ margin: '0 0 0.5rem 0', fontWeight: '600' }}>{group.name}</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>Group · {memberIds.length} members</p>
        </div>

        {group.description && (
          <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '12px', marginBottom: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{group.description}</p>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-secondary)', borderRadius: '12px', padding: '0.5rem 0' }}>
          
          {!isAdding && (
            <>
              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => setIsAdding(true)}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserPlus size={20} color="white" />
                </div>
                <span style={{ color: 'var(--accent-primary)', fontWeight: '500' }}>Add members</span>
              </div>
              
              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => {
                  navigator.clipboard.writeText(`https://nexchat.local/invite/${group.id}`);
                  alert('Invite link copied to clipboard!');
                }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <LinkIcon size={20} color="white" />
                </div>
                <span style={{ color: 'var(--accent-primary)', fontWeight: '500' }}>Invite via link</span>
              </div>
            </>
          )}

        {isAdding ? (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="user-selection-list">
              {nonMembers.map(u => (
                <div 
                  key={u.id} 
                  className={`user-selection-item ${selectedNewMembers.includes(u.id) ? 'selected' : ''}`}
                  onClick={() => setSelectedNewMembers(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                >
                  <div className="avatar sm" style={{ overflow: 'hidden' }}>
                    {u.avatarUrl ? (
                      <img src={`http://localhost:8080${u.avatarUrl}`} alt="" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                    ) : (
                      u.fullName?.[0]?.toUpperCase() || 'U'
                    )}
                  </div>
                  <span>{u.fullName || u.email}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn" style={{ flex: 1, background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} onClick={() => setIsAdding(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAddMembers}>Add Selected</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '0.5rem' }}>
              {memberIds.length} Members
            </div>
            {currentMembers.map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem', transition: 'background 0.2s', cursor: 'pointer' }}
                   onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                   onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div className="avatar sm" style={{ width: '40px', height: '40px', fontSize: '1.2rem', overflow: 'hidden' }}>
                  {u.avatarUrl ? (
                    <img src={`http://localhost:8080${u.avatarUrl}`} alt="" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                  ) : (
                    u.fullName?.[0]?.toUpperCase() || 'U'
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: '500' }}>{u.fullName || u.email}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{u.email}</span>
                </div>
              </div>
            ))}
            
            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', cursor: 'pointer', color: '#ef4444', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => {
                    alert('Exit Group clicked');
                }}
              >
                <LogOut size={20} />
                <span style={{ fontWeight: '500' }}>Exit group</span>
              </div>
              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', cursor: 'pointer', color: '#ef4444', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => {
                    alert('Report Group clicked');
                }}
              >
                <Shield size={20} />
                <span style={{ fontWeight: '500' }}>Report group</span>
              </div>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
