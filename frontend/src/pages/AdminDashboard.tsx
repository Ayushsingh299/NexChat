import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Users, MessageSquare, LayoutGrid, Activity, Smile, Frown, Meh, ShieldAlert, Server, Cpu, HardDrive, Wifi, Zap } from 'lucide-react';
import api from '../services/api';

interface AdminStats {
  totalUsers: number;
  totalGroups: number;
  totalMessages: number;
  messagesToday: number;
  positiveSentimentCount: number;
  negativeSentimentCount: number;
  neutralSentimentCount: number;
  spamMessagesCount: number;
}

interface PerformanceStats {
  activeWebSocketUsers: number;
  usedMemoryMB: number;
  maxMemoryMB: number;
  activeThreads: number;
  systemLoadAverage: number;
  availableProcessors: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [perfStats, setPerfStats] = useState<PerformanceStats | null>(null);
  const [latency, setLatency] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/admin/analytics');
        setStats(res.data);
      } catch (error) {
        console.error("Failed to load admin stats", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
    
    // Performance fetcher
    const fetchPerf = async () => {
      try {
        const start = performance.now();
        const res = await api.get('/admin/performance');
        const end = performance.now();
        setPerfStats(res.data);
        setLatency(Math.round(end - start));
      } catch (error) {
        console.error("Failed to fetch performance", error);
      }
    };
    
    fetchPerf();
    const interval = setInterval(fetchPerf, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <Activity size={48} className="text-primary animate-spin" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div style={{ minHeight: '100vh', padding: '2rem', backgroundColor: 'var(--bg-primary)', overflowY: 'auto' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2.5rem' }}>
          <Link to="/chat" style={{ marginRight: '1.5rem', padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: '50%', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', background: 'linear-gradient(to right, #60a5fa, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
              Admin Analytics Dashboard
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Global platform metrics and insights</p>
          </div>
        </div>

        {/* Top KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
          <StatCard title="Total Users" value={stats.totalUsers} icon={<Users size={24} color="#60a5fa" />} />
          <StatCard title="Total Groups" value={stats.totalGroups} icon={<LayoutGrid size={24} color="#a855f7" />} />
          <StatCard title="Total Messages" value={stats.totalMessages} icon={<MessageSquare size={24} color="#4ade80" />} />
          <StatCard title="Messages Today" value={stats.messagesToday} icon={<Activity size={24} color="#f472b6" />} />
        </div>

        {/* Infrastructure Health Section */}
        {perfStats && (
          <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <Server color="var(--accent-primary)" size={20} />
                Live Infrastructure Health
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#22c55e', animation: 'pulse 2s infinite' }} />
                Updates every 5s • Ping: {latency}ms
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              <StatCard title="Active WS Connections" value={perfStats.activeWebSocketUsers} icon={<Wifi size={24} color="#3b82f6" />} />
              <StatCard title="Active Threads" value={perfStats.activeThreads} icon={<Zap size={24} color="#eab308" />} />
              
              <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: '500', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                   <HardDrive size={16} /> JVM Memory (Heap)
                </p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                  <span style={{ fontSize: '2rem', fontWeight: 'bold' }}>{perfStats.usedMemoryMB}</span>
                  <span style={{ color: 'var(--text-muted)' }}>/ {perfStats.maxMemoryMB} MB</span>
                </div>
                <div style={{ width: '100%', background: 'var(--bg-secondary)', borderRadius: '9999px', height: '6px', marginTop: '0.5rem' }}>
                  <div style={{ backgroundColor: '#6366f1', height: '6px', borderRadius: '9999px', width: `${Math.min(100, (perfStats.usedMemoryMB / perfStats.maxMemoryMB) * 100)}%` }}></div>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: '500', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                   <Cpu size={16} /> OS System Load
                </p>
                <span style={{ fontSize: '2rem', fontWeight: 'bold' }}>{perfStats.systemLoadAverage >= 0 ? perfStats.systemLoadAverage.toFixed(2) : 'N/A'}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Cores: {perfStats.availableProcessors}</span>
              </div>
            </div>
          </div>
        )}

        {/* AI Analytics Section */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity color="var(--accent-primary)" size={20} />
            AI Content Analysis
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2.5rem' }}>
            {/* Sentiment Breakdown */}
            <div>
              <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: '500', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overall Sentiment</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <SentimentBar label="Positive" count={stats.positiveSentimentCount} total={stats.totalMessages} icon={<Smile size={18} color="#4ade80" />} color="#22c55e" />
                <SentimentBar label="Neutral" count={stats.neutralSentimentCount} total={stats.totalMessages} icon={<Meh size={18} color="#9ca3af" />} color="#6b7280" />
                <SentimentBar label="Negative" count={stats.negativeSentimentCount} total={stats.totalMessages} icon={<Frown size={18} color="#f87171" />} color="#ef4444" />
              </div>
            </div>

            {/* Moderation */}
            <div>
              <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: '500', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Moderation</h3>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.2)', borderRadius: '8px' }}>
                    <ShieldAlert size={28} color="#f87171" />
                  </div>
                  <div>
                    <p style={{ color: 'var(--text-primary)', fontWeight: '500', margin: 0 }}>Flagged Spam Messages</p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>Awaiting moderator review</p>
                  </div>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'white' }}>{stats.spamMessagesCount}</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string, value: number, icon: React.ReactNode }) {
  return (
    <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: '500', margin: '0 0 0.25rem 0' }}>{title}</p>
        <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>{value.toLocaleString()}</p>
      </div>
      <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
        {icon}
      </div>
    </div>
  );
}

function SentimentBar({ label, count, total, icon, color }: { label: string, count: number, total: number, icon: React.ReactNode, color: string }) {
  const percentage = total === 0 ? 0 : Math.round((count / total) * 100);
  
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontWeight: '500' }}>{icon} {label}</span>
        <span style={{ color: 'var(--text-secondary)' }}>{count} ({percentage}%)</span>
      </div>
      <div style={{ width: '100%', background: 'var(--bg-secondary)', borderRadius: '9999px', height: '0.625rem' }}>
        <div style={{ backgroundColor: color, height: '0.625rem', borderRadius: '9999px', width: `${percentage}%` }}></div>
      </div>
    </div>
  );
}
