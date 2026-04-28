import { useState, useEffect } from 'react'
import { Mail, Calendar, BookOpen, Activity, Play, CheckCircle, MessageSquare, X, Send, LogOut, GitBranch, Bell } from 'lucide-react'
import { auth } from './firebase'
import { onAuthStateChanged, type User, signOut } from 'firebase/auth'
import LoginScreen from './LoginScreen'
import DraftsModal from './DraftsModal'

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [showDrafts, setShowDrafts] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [latestEmails, setLatestEmails] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[] | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [notebookActivity, setNotebookActivity] = useState<any[] | null>(null);
  const [driveActivity, setDriveActivity] = useState<any[] | null>(null);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState([
    { role: 'bot', text: 'Hello! I am Moltbot, your executive assistant. How can I help you today?' }
  ]);
  const [noteText, setNoteText] = useState('');
  const [uploadingNote, setUploadingNote] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      // Strict CEO validation check on reload
      if (currentUser && currentUser.email === 'craig@alewood.co.uk') {
        setUser(currentUser);
      } else {
        if (currentUser) auth.signOut();
        setUser(null);
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    fetch('https://api.github.com/repos/AlewoodGroupLtd/Alewood-PA/commits?per_page=2')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setNotebookActivity(data);
        } else {
          setNotebookActivity([]);
        }
      })
      .catch(err => {
        console.error("GitHub Error", err);
        setNotebookActivity([]);
      });
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('googleAccessToken');
    if (user && token) {
      // Fetch Gmail Unread
      fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread', {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          console.error("Gmail Error:", data.error);
          setUnreadCount(-1); // Use -1 to represent error state
        } else if (data.messages) {
          setUnreadCount(data.messages.length);
          const top5 = data.messages.slice(0, 5);
          Promise.all(top5.map((m: any) => 
            fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`, {
              headers: { Authorization: `Bearer ${token}` }
            }).then(r => r.json())
          )).then(msgs => {
            const parsed = msgs.map((m: any) => {
              const headers = m.payload?.headers || [];
              const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
              const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown';
              return { id: m.id, subject, from, snippet: m.snippet };
            });
            setLatestEmails(parsed);
          });
        } else {
          setUnreadCount(0);
        }
      })
      .catch(err => {
        console.error("Gmail Network Error", err);
        setUnreadCount(-1);
      });

      // Fetch Calendar
      const timeMin = new Date().toISOString();
      fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&maxResults=3&singleEvents=true&orderBy=startTime`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          console.error("Calendar Error:", data.error);
          setCalendarError(`API Error: ${data.error.message || 'Check Console'}`);
          setMeetings([]);
        } else if (data.items) {
          setMeetings(data.items);
        } else {
          setMeetings([]);
        }
      })
      .catch(err => {
        console.error("Calendar Network Error", err);
        setCalendarError(`Network Error: ${err.message}`);
        setMeetings([]);
      });

      // Fetch Drive Activity
      fetch(`https://www.googleapis.com/drive/v3/files?orderBy=modifiedTime desc&pageSize=2&fields=files(id,name,modifiedTime)&q=mimeType='application/vnd.google-apps.document'`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          console.error("Drive Error:", data.error);
          setDriveError(`API Error: ${data.error.message}`);
          setDriveActivity([]);
        } else if (data.files) {
          setDriveActivity(data.files);
        } else {
          setDriveActivity([]);
        }
      })
      .catch(err => {
        console.error("Drive Network Error", err);
        setDriveError(`Network Error: ${err.message}`);
        setDriveActivity([]);
      });
    }
  }, [user]);

  if (loadingAuth) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
  }

  if (!user) {
    return <LoginScreen />;
  }

  const getFolderId = async (token: string) => {
    const folderRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder' and name='Meeting Notes/Brain Dumps' and trashed=false`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const folderData = await folderRes.json();
    if (folderData.files && folderData.files.length > 0) {
      return folderData.files[0].id;
    }
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Meeting Notes/Brain Dumps', mimeType: 'application/vnd.google-apps.folder' })
    });
    const createData = await createRes.json();
    return createData.id;
  };

  const handleUploadNote = async () => {
    if (!noteText.trim()) return;
    setUploadingNote(true);
    try {
      const token = localStorage.getItem('googleAccessToken');
      if (!token) throw new Error("No token");
      const folderId = await getFolderId(token);
      
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Quick Note ${new Date().toLocaleString()}`, mimeType: 'application/vnd.google-apps.document', parents: [folderId] })
      });
      const createData = await createRes.json();
      
      await fetch(`https://docs.googleapis.com/v1/documents/${createData.id}:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{ insertText: { location: { index: 1 }, text: noteText } }] })
      });
      setNoteText('');
      setDriveActivity(prev => [{ id: createData.id, name: `Quick Note ${new Date().toLocaleDateString()}`, modifiedTime: new Date().toISOString() }, ...(prev || [])].slice(0, 2));
    } catch (e) {
      console.error(e);
      alert('Failed to upload note.');
    } finally {
      setUploadingNote(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingNote(true);
    try {
      const token = localStorage.getItem('googleAccessToken');
      if (!token) throw new Error("No token");
      const folderId = await getFolderId(token);
      
      const uploadRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=media`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.type || 'application/octet-stream' },
        body: file
      });
      const uploadData = await uploadRes.json();

      await fetch(`https://www.googleapis.com/drive/v3/files/${uploadData.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, parents: [folderId] })
      });

      setDriveActivity(prev => [{ id: uploadData.id, name: file.name, modifiedTime: new Date().toISOString() }, ...(prev || [])].slice(0, 2));
    } catch (e) {
      console.error(e);
      alert('Failed to upload file.');
    } finally {
      setUploadingNote(false);
    }
  };

  const handleCommand = (cmd: string) => {
    setChatOpen(true);
    setMessage(cmd);
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    const userMessage = message;
    setChatHistory([...chatHistory, { role: 'user', text: userMessage }]);
    setMessage('');
    
    const lowerMsg = userMessage.toLowerCase();
    if (lowerMsg.includes('task') || lowerMsg.includes('remind me') || lowerMsg.includes('todo')) {
      try {
        const token = localStorage.getItem('googleAccessToken');
        if (token) {
          const folderId = await getFolderId(token);
          
          const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: `Bot Task - ${new Date().toLocaleString()}`, mimeType: 'application/vnd.google-apps.document', parents: [folderId] })
          });
          const createData = await createRes.json();
          
          await fetch(`https://docs.googleapis.com/v1/documents/${createData.id}:batchUpdate`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ requests: [{ insertText: { location: { index: 1 }, text: `Requested Task: ${userMessage}` } }] })
          });

          setChatHistory(prev => [...prev, { role: 'bot', text: 'Got it. I have sent this task to the processing pipeline. It will appear on your Master Pipeline sheet shortly.' }]);
          
          // Refresh drive activity
          setDriveActivity(prev => [{ id: createData.id, name: `Bot Task - ${new Date().toLocaleDateString()}`, modifiedTime: new Date().toISOString() }, ...(prev || [])].slice(0, 2));
          return;
        }
      } catch (err) {
        console.error(err);
      }
    }

    // Call the actual Moltbot backend Orchestrator API
    try {
      const response = await fetch('http://localhost:3000/api/orchestrator/command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ command: userMessage })
      });
      
      if (response.ok) {
        const data = await response.json();
        setChatHistory(prev => [...prev, { role: 'bot', text: data.message }]);
      } else {
        setChatHistory(prev => [...prev, { role: 'bot', text: 'Error: Failed to connect to the Antigravity Orchestrator backend.' }]);
      }
    } catch (err) {
      console.error(err);
      setChatHistory(prev => [...prev, { role: 'bot', text: 'Network Error: Make sure the Moltbot orchestrator is running on port 3000.' }]);
    }
  }
  const subscribeToPush = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: 'BNbVnYgafPKLI16_EZJn-gOSlD738Wnni2AGUUPudkb5d2KFP_FaqMoN89_ocYTU4686A2oVxEqyFB_LSMXZcuc'
        });

        await fetch('http://localhost:3000/api/orchestrator/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription)
        });
        alert('Push notifications enabled!');
      } else {
        alert('Permission for notifications was denied.');
      }
    } catch (e) {
      console.error('Failed to subscribe to push notifications:', e);
      alert('Error enabling push notifications. Check console.');
    }
  };

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
          <button className="icon-btn" onClick={subscribeToPush} title="Enable Notifications" style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
            <Bell size={20} color="#38bdf8" />
          </button>
          <div style={{ position: 'relative' }}>
            <img src="/ceo-avatar.png" alt="CEO Avatar" className="avatar" />
            <button onClick={() => signOut(auth)} className="icon-btn" style={{ position: 'absolute', bottom: -5, right: -5, background: 'var(--danger)', padding: '0.2rem', borderRadius: '50%' }}>
              <LogOut size={14} color="#fff" />
            </button>
          </div>
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
          <button className="btn" onClick={() => handleCommand('Spawn a new Antigravity agent')}>
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
            <span className="metric">{unreadCount === -1 ? <span style={{fontSize: '1.2rem', color: 'var(--danger)'}}>Auth Required</span> : unreadCount !== null ? `${unreadCount} Unread` : 'Loading...'}</span>
            <p style={{ marginTop: '0.5rem' }}>Emails automatically categorised and context-aware draft replies prepared.</p>
            <div style={{ marginTop: '1.5rem' }}>
              {latestEmails.length === 0 && unreadCount === 0 && (
                <div style={{ padding: '1rem 0', color: 'var(--text-secondary)' }}>Inbox zero!</div>
              )}
              {latestEmails.slice(0, 2).map((email, idx) => (
                <div key={email.id} className="list-item">
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 500, color: '#fff' }}>{email.subject}</span>
                    <span style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>From: {email.from}</span>
                  </div>
                  {idx === 0 ? <span className="tag">Action Required</span> : <CheckCircle size={20} color="var(--success)" />}
                </div>
              ))}
              
              {latestEmails.length > 2 && (
                <div style={{ background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.1)', padding: '1rem', borderRadius: '0.5rem', marginTop: '1rem', borderLeft: '3px solid #38bdf8' }}>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#38bdf8', marginBottom: '0.5rem', fontWeight: 600 }}>Moltbot Inbox Summary</div>
                  <div style={{ fontSize: '0.85rem', color: '#e2e8f0', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div>You have {unreadCount !== null ? unreadCount - 2 : latestEmails.length - 2} other emails pending.</div>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-secondary)' }}>
                      {latestEmails.slice(2).map(email => {
                        const isSpamOrPromo = email.from.toLowerCase().includes('noreply') || email.from.toLowerCase().includes('marketing') || email.subject.toLowerCase().includes('offer');
                        return (
                          <li key={email.id} style={{ marginBottom: '0.25rem' }}>
                            <span style={{ color: '#fff' }}>{email.subject}</span>
                            <span style={{ color: isSpamOrPromo ? 'var(--text-secondary)' : '#f59e0b', marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                              [{isSpamOrPromo ? 'Suggest: Archive' : 'Suggest: Review'}]
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
          <button className="btn" style={{ background: '#a855f7' }} onClick={() => setShowDrafts(true)}>
            Review Drafts
          </button>
        </div>

        <div className="card glass-panel">
          <div className="card-header">
            <Calendar color="#f59e0b" size={24} />
            Schedule & Focus
          </div>
          <div className="card-content">
            <span className="metric">
              {meetings === null ? 'Syncing...' : meetings.length > 0 ? 'Upcoming Meetings' : 'Clear Schedule'}
            </span>
            {calendarError && <p style={{ marginTop: '0.5rem', color: 'var(--danger)' }}>{calendarError}</p>}
            <p style={{ marginTop: '0.5rem' }}>Your schedule is synced directly from Google Calendar.</p>
            <div style={{ marginTop: '1.5rem' }}>
              {meetings !== null && meetings.length === 0 && !calendarError && (
                <div style={{ padding: '1rem 0', color: 'var(--text-secondary)' }}>No upcoming meetings. Enjoy your free time!</div>
              )}
              {meetings !== null && meetings.map((m, idx) => {
                const startTime = new Date(m.start?.dateTime || m.start?.date);
                const isAllDay = !m.start?.dateTime;
                return (
                  <div key={m.id || idx} className="list-item">
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 500, color: '#fff' }}>{m.summary || 'Untitled Event'}</span>
                      <span style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                        {isAllDay ? 'All Day' : startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    {idx === 0 ? <span className="tag" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>Up Next</span> : null}
                  </div>
                );
              })}
            </div>
          </div>
          <button className="btn" style={{ background: '#f59e0b', color: '#000' }} onClick={() => handleCommand('Modify my schedule for today')}>
            Modify Schedule
          </button>
        </div>

        <div className="card glass-panel">
          <div className="card-header">
            <BookOpen color="#ec4899" size={24} />
            Trinity Master Notebook
          </div>
          <div className="card-content">
            <span className="metric">Live Connection</span>
            <p style={{ marginTop: '0.5rem' }}>Access your Alewood Trinity Master Notebook on NotebookLM.</p>
            <div style={{ marginTop: '1.5rem' }}>
              <div style={{ marginBottom: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Recent Notebook Activity
              </div>
              {driveError && (
                <div style={{ padding: '0.5rem 0', color: 'var(--danger)', fontSize: '0.85rem' }}>
                  {driveError} (Please re-login to authorize Drive access)
                </div>
              )}
              {driveActivity === null && !driveError && (
                <div style={{ padding: '0.5rem 0', color: 'var(--text-secondary)' }}>Fetching notebook sources...</div>
              )}
              {driveActivity !== null && driveActivity.length === 0 && (
                <div style={{ padding: '0.5rem 0', color: 'var(--text-secondary)' }}>No recent notebook documents found.</div>
              )}
              {driveActivity !== null && driveActivity.map((file, idx) => (
                <div key={file.id || idx} className="list-item">
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 500, color: '#fff', fontSize: '0.9rem' }}>
                      {file.name}
                    </span>
                    <span style={{ fontSize: '0.8rem', marginTop: '0.2rem', color: 'var(--text-secondary)' }}>
                      Ingested • {new Date(file.modifiedTime).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            <div style={{ marginTop: '1.5rem', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', marginBottom: '0.5rem' }}>Drop Notes & Files</div>
              <textarea 
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Type a quick brain dump here..."
                style={{ width: '100%', minHeight: '60px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.5rem', borderRadius: '0.25rem', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button 
                  onClick={handleUploadNote} 
                  disabled={uploadingNote || !noteText.trim()}
                  className="btn" 
                  style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem', background: '#ec4899', color: '#fff', border: 'none', cursor: uploadingNote || !noteText.trim() ? 'not-allowed' : 'pointer', opacity: uploadingNote || !noteText.trim() ? 0.5 : 1 }}>
                  {uploadingNote ? 'Uploading...' : 'Save Note'}
                </button>
                <label className="btn" style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', cursor: uploadingNote ? 'not-allowed' : 'pointer', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', opacity: uploadingNote ? 0.5 : 1 }}>
                  {uploadingNote ? '...' : 'File'}
                  <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploadingNote} />
                </label>
              </div>
            </div>

          </div>
          <a 
            href="https://notebooklm.google.com/notebook/d5f54be5-e2aa-43b6-89d9-d14b922cfcc3" 
            target="_blank" 
            rel="noreferrer" 
            className="btn" 
            style={{ background: '#ec4899', textDecoration: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
          >
            <BookOpen size={18} style={{ marginRight: '0.5rem' }} />
            Open NotebookLM
          </a>
        </div>

        <div className="card glass-panel">
          <div className="card-header">
            <GitBranch color="#10b981" size={24} />
            Repository Activity
          </div>
          <div className="card-content">
            <span className="metric">GitHub Sync</span>
            <p style={{ marginTop: '0.5rem' }}>Latest commits from Alewood-PA.</p>
            <div style={{ marginTop: '1.5rem' }}>
              {notebookActivity === null && (
                <div style={{ padding: '0.5rem 0', color: 'var(--text-secondary)' }}>Fetching activity...</div>
              )}
              {notebookActivity !== null && notebookActivity.length === 0 && (
                <div style={{ padding: '0.5rem 0', color: 'var(--text-secondary)' }}>No recent activity found.</div>
              )}
              {notebookActivity !== null && notebookActivity.map((activity, idx) => (
                <div key={activity.sha || idx} className="list-item">
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 500, color: '#fff', fontSize: '0.9rem' }}>
                      {activity.commit?.message?.split('\n')[0] || 'Code Update'}
                    </span>
                    <span style={{ fontSize: '0.8rem', marginTop: '0.2rem', color: 'var(--text-secondary)' }}>
                      {activity.commit?.author?.name || 'System'} • {new Date(activity.commit?.author?.date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <a 
            href="https://github.com/AlewoodGroupLtd/Alewood-PA" 
            target="_blank" 
            rel="noreferrer" 
            className="btn" 
            style={{ background: '#10b981', textDecoration: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
          >
            <GitBranch size={18} style={{ marginRight: '0.5rem' }} />
            Open Repository
          </a>
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
      
      {showDrafts && <DraftsModal emails={latestEmails} onClose={() => setShowDrafts(false)} />}
    </>
  )
}

export default App
