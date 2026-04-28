import { useState } from 'react'
import { Mail, Calendar, BookOpen, Activity, Play, CheckCircle, MessageSquare, X, Send } from 'lucide-react'

function App() {
  const [syncing, setSyncing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { role: 'bot', text: 'Hello! I am Moltbot, your executive assistant. How can I help you today?' }
  ]);

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => setSyncing(false), 2000);
  }

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    setChatHistory([...chatHistory, { role: 'user', text: message }]);
    setMessage('');
    
    // Simulate bot response
    setTimeout(() => {
      setChatHistory(prev => [...prev, { role: 'bot', text: 'I have logged your request. I will coordinate with the Antigravity agents to execute this.' }]);
    }, 1000);
  }

  return (
    <>
      <header className="header glass-panel">
        <div className="logo">
          <img src="/alewood-logo.png" alt="Alewood Logo" className="logo-img" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>CEO Portal</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
              System Online <span className="status-indicator"></span>
            </div>
          </div>
          <img src="/ceo-avatar.png" alt="CEO Avatar" className="avatar" />
        </div>
      </header>

      <main className="dashboard">
        <div className="card glass-panel">
          <div className="card-header">
            <Activity color="#38bdf8" size={24} />
            Antigravity Orchestrator
          </div>
          <div className="card-content">
            <span className="metric">3 Agents Active</span>
            <p style={{ marginTop: '0.5rem' }}>Moltbot is currently managing background infrastructure operations autonomously.</p>
            <div style={{ marginTop: '1.5rem' }}>
              <div className="list-item">
                <span style={{ fontWeight: 500 }}>Deployment Pipeline</span>
                <span className="tag" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>Running</span>
              </div>
              <div className="list-item">
                <span style={{ fontWeight: 500 }}>Code Refactoring</span>
                <span className="tag" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>Completed</span>
              </div>
            </div>
          </div>
          <button className="btn">
            <Play size={18} />
            Spawn New Agent
          </button>
        </div>

        <div className="card glass-panel">
          <div className="card-header">
            <Mail color="#a855f7" size={24} />
            Workspace Triage
          </div>
          <div className="card-content">
            <span className="metric">12 Unread</span>
            <p style={{ marginTop: '0.5rem' }}>Emails automatically categorised and context-aware draft replies prepared.</p>
            <div style={{ marginTop: '1.5rem' }}>
              <div className="list-item">
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 500, color: '#fff' }}>Urgent: Q3 Board Deck</span>
                  <span style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>Draft prepared by Moltbot</span>
                </div>
                <span className="tag">Action Required</span>
              </div>
              <div className="list-item">
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 500, color: '#fff' }}>Vendor Contract Review</span>
                  <span style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>Summarised successfully</span>
                </div>
                <CheckCircle size={20} color="var(--success)" />
              </div>
            </div>
          </div>
          <button className="btn" style={{ background: '#a855f7' }}>
            Review Drafts
          </button>
        </div>

        <div className="card glass-panel">
          <div className="card-header">
            <Calendar color="#f59e0b" size={24} />
            Schedule & Focus
          </div>
          <div className="card-content">
            <span className="metric">Next: 2:00 PM</span>
            <p style={{ marginTop: '0.5rem' }}>Product Strategy Sync - Confirmed</p>
            <div style={{ marginTop: '1.5rem', background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.05)' }}>
              <strong style={{ color: '#fff', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle size={16} color="var(--success)" /> Automated Action:
              </strong>
              <span style={{ lineHeight: 1.6 }}>Moltbot automatically blocked <strong>3:00 PM - 4:00 PM</strong> as "Focus Time" due to high incoming email volume detected today.</span>
            </div>
          </div>
          <button className="btn" style={{ background: '#f59e0b', color: '#000' }}>
            Modify Schedule
          </button>
        </div>

        <div className="card glass-panel">
          <div className="card-header">
            <BookOpen color="#ec4899" size={24} />
            Trinity Master Notebook
          </div>
          <div className="card-content">
            <span className="metric">Fully Synced</span>
            <p style={{ marginTop: '0.5rem' }}>Latest knowledge base ingest complete via NotebookLM Enterprise API.</p>
            <div style={{ marginTop: '1.5rem' }}>
              <div className="list-item">
                <span style={{ fontWeight: 500 }}>Morning Standup Transcript</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Added 10m ago</span>
              </div>
              <div className="list-item">
                <span style={{ fontWeight: 500 }}>GitHub PR #402 Summary</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Added 1h ago</span>
              </div>
            </div>
          </div>
          <button className="btn" style={{ background: '#ec4899' }} onClick={handleSync}>
            <Activity size={18} className={syncing ? 'sync-spin' : ''} />
            {syncing ? 'Syncing...' : 'Force Sync Data'}
          </button>
        </div>
      </main>

      <button className="chat-fab" onClick={() => setChatOpen(true)}>
        <MessageSquare size={24} color="#fff" />
      </button>

      <div className={`chat-panel glass-panel ${chatOpen ? 'open' : ''}`}>
        <div className="chat-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Activity color="#38bdf8" />
            <span style={{ fontWeight: 600 }}>Moltbot Assistant</span>
          </div>
          <button className="icon-btn" onClick={() => setChatOpen(false)}>
            <X size={20} color="#fff" />
          </button>
        </div>
        
        <div className="chat-messages">
          {chatHistory.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
              <div className="message-bubble">{msg.text}</div>
            </div>
          ))}
        </div>

        <form className="chat-input-area" onSubmit={handleSendMessage}>
          <input 
            type="text" 
            placeholder="Tell Moltbot what to do..." 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="chat-input"
          />
          <button type="submit" className="chat-send-btn">
            <Send size={18} color="#fff" />
          </button>
        </form>
      </div>

      <style>{`
        .sync-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}

export default App
