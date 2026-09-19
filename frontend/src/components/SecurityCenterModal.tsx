import React, { useState, useEffect } from 'react';
import { X, Shield, Key, Monitor, FileText, Trash2, Download, LogOut, Loader2 } from 'lucide-react';
import api from '../services/api';

interface UserSession {
  tokenId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
}

interface SecurityAudit {
  id: number;
  action: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

interface SecurityCenterModalProps {
  onClose: () => void;
  onLogout: () => void;
}

export default function SecurityCenterModal({ onClose, onLogout }: SecurityCenterModalProps) {
  const [activeTab, setActiveTab] = useState<'security' | 'devices' | 'audit' | 'data'>('security');
  
  // States
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [audits, setAudits] = useState<SecurityAudit[]>([]);
  const [loading, setLoading] = useState(false);

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    if (activeTab === 'devices') fetchSessions();
    if (activeTab === 'audit') fetchAudits();
  }, [activeTab]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await api.get('/security/sessions');
      setSessions(res.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const fetchAudits = async () => {
    setLoading(true);
    try {
      const res = await api.get('/security/audit');
      setAudits(res.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChangingPassword(true);
    setPasswordMsg({ type: '', text: '' });
    try {
      await api.post('/security/change-password', { currentPassword, newPassword });
      setPasswordMsg({ type: 'success', text: 'Password changed successfully' });
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.response?.data || 'Failed to change password' });
    }
    setIsChangingPassword(false);
  };

  const handleRevokeSession = async (tokenId: string) => {
    try {
      await api.delete(`/security/sessions/${tokenId}`);
      fetchSessions();
    } catch (err) {
      alert('Failed to revoke session');
    }
  };

  const handleRevokeOtherSessions = async () => {
    if (window.confirm('Are you sure you want to log out of all other devices?')) {
      try {
        await api.delete('/security/sessions/others');
        fetchSessions();
        alert('Logged out of all other devices');
      } catch (err) {
        alert('Failed to revoke other sessions');
      }
    }
  };

  const handleExportData = async () => {
    try {
      const res = await api.get('/security/export');
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "nexchat_export.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    } catch (err) {
      alert('Failed to export data');
    }
  };

  const handleDeleteAccount = async () => {
    if (window.confirm('CRITICAL WARNING: This will permanently delete your account and revoke all sessions. Type OK to continue.')) {
      try {
        await api.delete('/security/account');
        alert('Account deleted. Logging out...');
        onLogout();
      } catch (err) {
        alert('Failed to delete account');
      }
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel" style={{ maxWidth: '700px', width: '90%', animation: 'slide-up 0.3s ease', display: 'flex', flexDirection: 'column', height: '80vh' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield className="text-accent" size={24} />
            <h2 style={{ margin: 0 }}>Privacy & Security Center</h2>
          </div>
          <button onClick={onClose} className="close-btn" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', marginTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          {/* Sidebar */}
          <div style={{ width: '200px', borderRight: '1px solid var(--border-color)', padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button 
              onClick={() => setActiveTab('security')} 
              style={{ background: activeTab === 'security' ? 'var(--bg-tertiary)' : 'transparent', border: 'none', padding: '0.75rem 1rem', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: activeTab === 'security' ? 'var(--accent-primary)' : 'var(--text-primary)', borderRadius: '0 8px 8px 0', borderLeft: activeTab === 'security' ? '3px solid var(--accent-primary)' : '3px solid transparent' }}
            >
              <Key size={18} /> Password
            </button>
            <button 
              onClick={() => setActiveTab('devices')} 
              style={{ background: activeTab === 'devices' ? 'var(--bg-tertiary)' : 'transparent', border: 'none', padding: '0.75rem 1rem', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: activeTab === 'devices' ? 'var(--accent-primary)' : 'var(--text-primary)', borderRadius: '0 8px 8px 0', borderLeft: activeTab === 'devices' ? '3px solid var(--accent-primary)' : '3px solid transparent' }}
            >
              <Monitor size={18} /> Active Devices
            </button>
            <button 
              onClick={() => setActiveTab('audit')} 
              style={{ background: activeTab === 'audit' ? 'var(--bg-tertiary)' : 'transparent', border: 'none', padding: '0.75rem 1rem', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: activeTab === 'audit' ? 'var(--accent-primary)' : 'var(--text-primary)', borderRadius: '0 8px 8px 0', borderLeft: activeTab === 'audit' ? '3px solid var(--accent-primary)' : '3px solid transparent' }}
            >
              <FileText size={18} /> Audit Logs
            </button>
            <button 
              onClick={() => setActiveTab('data')} 
              style={{ background: activeTab === 'data' ? 'var(--bg-tertiary)' : 'transparent', border: 'none', padding: '0.75rem 1rem', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: activeTab === 'data' ? 'var(--accent-primary)' : 'var(--text-primary)', borderRadius: '0 8px 8px 0', borderLeft: activeTab === 'data' ? '3px solid var(--accent-primary)' : '3px solid transparent' }}
            >
              <Trash2 size={18} /> Data Controls
            </button>
          </div>

          {/* Content Area */}
          <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
            
            {activeTab === 'security' && (
              <div>
                <h3 style={{ marginTop: 0 }}>Change Password</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Ensure your account is using a long, random password to stay secure.</p>
                
                <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem', maxWidth: '400px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Current Password</label>
                    <input 
                      type="password" 
                      className="chat-input"
                      value={currentPassword} 
                      onChange={e => setCurrentPassword(e.target.value)} 
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>New Password</label>
                    <input 
                      type="password" 
                      className="chat-input"
                      value={newPassword} 
                      onChange={e => setNewPassword(e.target.value)} 
                      required
                    />
                  </div>
                  
                  {passwordMsg.text && (
                    <div style={{ padding: '0.75rem', borderRadius: '8px', fontSize: '0.9rem', background: passwordMsg.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: passwordMsg.type === 'success' ? '#22c55e' : '#ef4444' }}>
                      {passwordMsg.text}
                    </div>
                  )}

                  <button 
                    type="submit" 
                    disabled={isChangingPassword}
                    style={{ background: 'var(--accent-primary)', border: 'none', color: 'white', padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '1rem' }}
                  >
                    {isChangingPassword && <Loader2 size={16} className="animate-spin" />} Update Password
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'devices' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0 }}>Active Devices</h3>
                  <button onClick={handleRevokeOtherSessions} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <LogOut size={16} /> Log Out All Others
                  </button>
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Here are all the devices that are currently logged into your account.</p>
                
                {loading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 className="animate-spin text-accent" /></div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {sessions.map(s => (
                      <div key={s.tokenId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                            <Monitor size={20} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{s.userAgent}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                              IP: {s.ipAddress} • Logged in: {new Date(s.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleRevokeSession(s.tokenId)}
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.5rem', borderRadius: '4px' }}
                          title="Revoke Session"
                        >
                          <LogOut size={20} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'audit' && (
              <div>
                <h3 style={{ marginTop: 0 }}>Security Audit Logs</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>A chronological history of security-related events on your account.</p>
                
                {loading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 className="animate-spin text-accent" /></div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {audits.map(a => (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                        <div style={{ marginTop: '0.2rem', color: 'var(--accent-primary)' }}>
                          <Shield size={16} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{a.action}</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(a.createdAt).toLocaleString()}</span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            {a.ipAddress} • {a.userAgent}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'data' && (
              <div>
                <h3 style={{ marginTop: 0 }}>Data & Account Control</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>Manage your data presence on NexChat.</p>
                
                <div style={{ background: 'var(--bg-tertiary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <Download className="text-accent" size={20} />
                    <h4 style={{ margin: 0 }}>Export Account Data</h4>
                  </div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Download a JSON file containing all your profile information and preferences.</p>
                  <button onClick={handleExportData} style={{ background: 'transparent', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}>
                    Request Export
                  </button>
                </div>

                <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <Trash2 color="#ef4444" size={20} />
                    <h4 style={{ margin: 0, color: '#ef4444' }}>Delete Account</h4>
                  </div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Permanently delete your account. This action cannot be undone. You will lose access to all your private chats.</p>
                  <button onClick={handleDeleteAccount} style={{ background: '#ef4444', border: 'none', color: 'white', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}>
                    Delete Account
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
