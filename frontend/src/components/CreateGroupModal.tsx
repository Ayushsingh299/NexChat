import React, { useState } from 'react';
import { X, Users } from 'lucide-react';
import api from '../services/api';

interface User {
  id: number;
  email: string;
  fullName: string;
}

interface Props {
  users: User[];
  onClose: () => void;
  onGroupCreated: (group: any) => void;
}

export default function CreateGroupModal({ users, onClose, onGroupCreated }: Props) {
  const [name, setName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const res = await api.post('/groups', {
        name,
        description: '',
        memberIds: selectedUsers
      });
      onGroupCreated(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleUser = (id: number) => {
    setSelectedUsers(prev => 
      prev.includes(id) ? prev.filter(uId => uId !== id) : [...prev, id]
    );
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel animate-slide-up">
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}><Users size={18} style={{marginRight: '8px', verticalAlign: 'middle'}}/> Create New Group</h3>
          <button className="close-btn" style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }} onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Group Name</label>
            <input 
              type="text" 
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Select Members</label>
            <div className="user-selection-list">
              {users.map(u => (
                <div 
                  key={u.id} 
                  className={`user-selection-item ${selectedUsers.includes(u.id) ? 'selected' : ''}`}
                  onClick={() => toggleUser(u.id)}
                >
                  <div className="avatar sm">{u.fullName?.[0]?.toUpperCase() || 'U'}</div>
                  <span>{u.fullName || u.email}</span>
                </div>
              ))}
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{width: '100%', marginTop: '1rem'}}>
            Create Group
          </button>
        </form>
      </div>
    </div>
  );
}
