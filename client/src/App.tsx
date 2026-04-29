import { useState, useEffect } from 'react'
import { Mail, Calendar, BookOpen, Activity, Play, CheckCircle, MessageSquare, X, Send, LogOut, GitBranch, Bell, Mic, Users, PoundSterling, Kanban, List, BarChart, Globe, Newspaper, Archive, ThumbsUp, ThumbsDown, CheckSquare, Share2, Trash2 } from 'lucide-react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from './firebase'
import { onAuthStateChanged, type User, signOut, signInWithPopup, GoogleAuthProvider } from 'firebase/auth'
import LoginScreen from './LoginScreen'
import DraftsModal from './DraftsModal'
import TaskModal from './TaskModal'
import EventModal from './EventModal'
import IndustrySettingsModal from './IndustrySettingsModal'
import { KanbanView, GanttView } from './TaskViews'
import SchedulePane from './SchedulePane'
import MarketingTab from './MarketingTab'

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [showDrafts, setShowDrafts] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [activeTab, setActiveTab] = useState('Operations');
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [latestEmails, setLatestEmails] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[] | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [notebookActivity, setNotebookActivity] = useState<any[] | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'gantt'>('list');
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [showIndustrySettings, setShowIndustrySettings] = useState(false);
  const [driveActivity, setDriveActivity] = useState<any[] | null>(null);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState([
    { role: 'bot', text: 'Hello! I am Moltbot, your executive assistant. How can I help you today?' }
  ]);
  const [noteText, setNoteText] = useState('');
  const [uploadingNote, setUploadingNote] = useState(false);
  const [pipelineTasks, setPipelineTasks] = useState<any[] | null>(null);
  const [activeAgents, setActiveAgents] = useState<any[] | null>(null);
  const [orchestratorError, setOrchestratorError] = useState<string | null>(null);
  const [industryConfig, setIndustryConfig] = useState<any>(null);
  const [industryUpdates, setIndustryUpdates] = useState<any[] | null>(null);
  const [archivedUpdates, setArchivedUpdates] = useState<string[]>(() => {
    const saved = localStorage.getItem('archivedIndustryUpdates');
    return saved ? JSON.parse(saved) : [];
  });
  const [needsTokenRefresh, setNeedsTokenRefresh] = useState(false);

  const handleTokenRefresh = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        localStorage.setItem('googleAccessToken', credential.accessToken);
        setNeedsTokenRefresh(false);
        window.location.reload();
      }
    } catch (err) {
      console.error('Refresh failed', err);
    }
  };

  useEffect(() => {
    const fetchConfig = async () => {
      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.industryConfig) {
              setIndustryConfig(data.industryConfig);
              localStorage.setItem('industryConfig', JSON.stringify(data.industryConfig));
            } else {
              const defaultConfig = { competitors: ['Accenture', 'Deloitte'], clients: ['HSBC', 'Barclays'], keywords: ['Artificial Intelligence', 'Fintech'] };
              setIndustryConfig(defaultConfig);
              await setDoc(docRef, { industryConfig: defaultConfig }, { merge: true });
            }
            if (data.archivedUpdates) {
              setArchivedUpdates(data.archivedUpdates);
              localStorage.setItem('archivedIndustryUpdates', JSON.stringify(data.archivedUpdates));
            }
            if (data.industryUpdates) {
              setIndustryUpdates(data.industryUpdates);
            }
          } else {
            const defaultConfig = { competitors: ['Accenture', 'Deloitte'], clients: ['HSBC', 'Barclays'], keywords: ['Artificial Intelligence', 'Fintech'] };
            setIndustryConfig(defaultConfig);
            await setDoc(docRef, { industryConfig: defaultConfig, archivedUpdates: [] }, { merge: true });
          }
        } catch (e) {
          console.error("Failed to fetch config from Firestore", e);
        }
      }
    };
    fetchConfig();
  }, [user]);

  useEffect(() => {
    if (!industryConfig) return;
    // Don't clear existing updates so the user can see them immediately
    fetch('https://alewood-moltbot-343832934198.europe-west2.run.app/api/orchestrator/industry-pulse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(industryConfig)
    })
    .then(res => res.json())
    .then(data => {
      if (data.updates) {
        setIndustryUpdates(prev => {
          const prevUpdates = prev || [];
          const newUrls = new Set(data.updates.map((u: any) => u.url));
          const oldUpdatesToKeep = prevUpdates.filter((u: any) => !newUrls.has(u.url));
          const merged = [...data.updates, ...oldUpdatesToKeep];
          merged.sort((a, b) => b.timestamp - a.timestamp);
          const finalUpdates = merged.slice(0, 50);
          
          if (user) {
            setDoc(doc(db, 'users', user.uid), { industryUpdates: finalUpdates }, { merge: true });
          }
          return finalUpdates;
        });
      }
    })
    .catch(err => {
      console.error(err);
      setIndustryUpdates(prev => prev || []);
    });
  }, [industryConfig, user]);

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

    fetch('https://alewood-moltbot-343832934198.europe-west2.run.app/api/orchestrator/agents')
      .then(res => res.json())
      .then(data => {
        if (data.agents) {
          setActiveAgents(data.agents);
          setOrchestratorError(null);
          const needsAction = data.agents.filter((a: any) => a.requiresAction);
          if (needsAction.length > 0 && Notification.permission === 'granted') {
            const notifiedAgents = JSON.parse(sessionStorage.getItem('notifiedAgents') || '[]');
            const newAgentsToNotify = needsAction.filter((a: any) => !notifiedAgents.includes(a.id));
            if (newAgentsToNotify.length > 0) {
              new Notification('Agent Needs Input', {
                body: `${newAgentsToNotify.map((a: any) => a.name).join(', ')} require your attention!`,
                icon: '/alewood-logo.png'
              });
              sessionStorage.setItem('notifiedAgents', JSON.stringify([...notifiedAgents, ...newAgentsToNotify.map((a: any) => a.id)]));
            }
          }
        } else {
          setOrchestratorError("Invalid response from orchestrator.");
        }
      })
      .catch(err => {
        console.error("Agents fetch failed:", err);
        setOrchestratorError(`Connection failed: ${err.message}`);
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
          if (data.error.code === 401) {
            setNeedsTokenRefresh(true);
            return;
          }
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
      const timeMin = new Date();
      timeMin.setHours(0,0,0,0);
      const timeMax = new Date();
      timeMax.setMonth(timeMax.getMonth() + 2); // fetch next 2 months
      fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&maxResults=100&singleEvents=true&orderBy=startTime`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          if (data.error.code === 401) {
            setNeedsTokenRefresh(true);
            return;
          }
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
          if (data.error.code === 401) {
            setNeedsTokenRefresh(true);
            return;
          }
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

      // Fetch Pipeline Tasks
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/1yskd_H80YpKH5pW1vwpVVyIi49Ce86m87VQP99VJ2mw/values/Pipeline!A:I`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          if (data.error.code === 401) {
            setNeedsTokenRefresh(true);
            return;
          }
          console.error("Sheets Fetch Error", data.error);
          setPipelineTasks([]);
        } else if (data.values) {
          const tasks = data.values.slice(1).map((row: any, idx: number) => ({
            id: idx + 2, // Row index in Google Sheets
            rowIdx: idx + 2,
            task: row[0],
            assignee: row[1],
            priority: row[2],
            status: row[3],
            dueDate: row[4] || 'TBD',
            sourceUrl: row[5] || null,
            category: row[6] || 'Project Management',
            createdAt: row[7] || null,
            completedAt: row[8] || null
          }));
          
          setPipelineTasks(tasks);

          const today = new Date().toISOString().split('T')[0];
          const dueTasks = tasks.filter((t: any) => t.dueDate !== 'TBD' && t.dueDate <= today);
          if (dueTasks.length > 0 && Notification.permission === 'granted') {
            new Notification('Tasks Due or Overdue', {
              body: `You have ${dueTasks.length} pending task(s) that need immediate attention!`,
              icon: '/alewood-logo.png'
            });
          }
        } else {
          setPipelineTasks([]);
        }
      })
      .catch(err => {
        console.error("Sheets Fetch Error", err);
        setPipelineTasks([]);
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
        body: JSON.stringify({ name: `Quick Note ${new Date().toLocaleString('en-GB')}`, mimeType: 'application/vnd.google-apps.document', parents: [folderId] })
      });
      const createData = await createRes.json();
      
      await fetch(`https://docs.googleapis.com/v1/documents/${createData.id}:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{ insertText: { location: { index: 1 }, text: noteText } }] })
      });
      setNoteText('');
      setDriveActivity(prev => [{ id: createData.id, name: `Quick Note ${new Date().toLocaleDateString('en-GB')}`, modifiedTime: new Date().toISOString() }, ...(prev || [])].slice(0, 2));
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



  const handleArchiveUpdate = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newArchived = [...archivedUpdates, id];
    setArchivedUpdates(newArchived);
    localStorage.setItem('archivedIndustryUpdates', JSON.stringify(newArchived));
    if (user) {
      setDoc(doc(db, 'users', user.uid), { archivedUpdates: newArchived }, { merge: true });
    }
  };

  const sendSilentCommand = async (cmd: string, payload?: any) => {
    try {
      const token = localStorage.getItem('googleAccessToken');
      await fetch('https://alewood-moltbot-343832934198.europe-west2.run.app/api/orchestrator/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd, token, ...payload })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleRateUpdate = (e: React.MouseEvent, update: any, isUseful: boolean) => {
    e.stopPropagation();
    sendSilentCommand(`[News Feedback]: Rated "${update.headline}" as ${isUseful ? 'useful' : 'NOT useful'}. Please adjust future monitoring weights for ${update.tag}.`);
    if (!isUseful) {
      handleArchiveUpdate(e, update.url); // Archive it after rating if not useful
    }
  };

  const handleCommand = async (cmd: string = message) => {
    setChatOpen(true);
    setMessage(cmd);
  };

  const sendDirectMessage = async (userMessage: string) => {
    setChatOpen(true);
    setChatHistory(prev => [...prev, { role: 'user', text: userMessage }]);
    
    try {
      const token = localStorage.getItem('googleAccessToken');
      const response = await fetch('https://alewood-moltbot-343832934198.europe-west2.run.app/api/orchestrator/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: userMessage, token })
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
  };

  const startListening = () => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-GB';

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setMessage(prev => prev ? prev + ' ' + transcript : transcript);
    };
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    
    recognition.start();
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    const userMessage = message;
    setChatHistory([...chatHistory, { role: 'user', text: userMessage }]);
    setMessage('');
    
    const lowerMsg = userMessage.toLowerCase();
    if (!lowerMsg.startsWith('create task:') && (lowerMsg.includes('task') || lowerMsg.includes('remind me') || lowerMsg.includes('todo'))) {
      try {
        const token = localStorage.getItem('googleAccessToken');
        if (token) {
          const folderId = await getFolderId(token);
          
          const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: `Bot Task - ${new Date().toLocaleString('en-GB')}`, mimeType: 'application/vnd.google-apps.document', parents: [folderId] })
          });
          const createData = await createRes.json();
          
          await fetch(`https://docs.googleapis.com/v1/documents/${createData.id}:batchUpdate`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ requests: [{ insertText: { location: { index: 1 }, text: `Requested Task: ${userMessage}` } }] })
          });

          setChatHistory(prev => [...prev, { role: 'bot', text: 'Got it. I have sent this task to the processing pipeline. It will appear on your Master Pipeline sheet shortly.' }]);
          
          // Refresh drive activity
          setDriveActivity(prev => [{ id: createData.id, name: `Bot Task - ${new Date().toLocaleDateString('en-GB')}`, modifiedTime: new Date().toISOString() }, ...(prev || [])].slice(0, 2));
          return;
        }
      } catch (err) {
        console.error(err);
      }
    }

    // Call the actual Moltbot backend Orchestrator API
    try {
      const token = localStorage.getItem('googleAccessToken');
      const response = await fetch('https://alewood-moltbot-343832934198.europe-west2.run.app/api/orchestrator/command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ command: userMessage, token })
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

        await fetch('https://alewood-moltbot-343832934198.europe-west2.run.app/api/orchestrator/subscribe', {
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

  const handleTaskSave = (updatedTask: any) => {
    setPipelineTasks((prev: any) => prev?.map((t: any) => t.id === updatedTask.id ? updatedTask : t) || []);
    setSelectedTask(null);
  };

  const updateTaskInSheet = async (updatedTask: any) => {
    try {
      const token = localStorage.getItem('googleAccessToken');
      if (!token) throw new Error("Not authenticated with Google");

      const SPREADSHEET_ID = '1yskd_H80YpKH5pW1vwpVVyIi49Ce86m87VQP99VJ2mw';
      const rowIdx = updatedTask.rowIdx;

      let completedAt = updatedTask.completedAt || "";
      if (updatedTask.status === 'Done' && !completedAt) {
        completedAt = new Date().toISOString();
      } else if (updatedTask.status !== 'Done') {
        completedAt = "";
      }
      
      const taskToSave = { ...updatedTask, completedAt };

      const values = [[
        taskToSave.task,
        taskToSave.assignee,
        taskToSave.priority,
        taskToSave.status,
        taskToSave.dueDate,
        taskToSave.sourceUrl || "",
        taskToSave.category || "Project Management",
        taskToSave.createdAt || "",
        completedAt
      ]];

      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Pipeline!A${rowIdx}:I${rowIdx}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values })
      });

      if (!res.ok) throw new Error("Failed to update spreadsheet");

      setPipelineTasks((prev: any) => prev?.map((t: any) => t.id === taskToSave.id ? taskToSave : t) || []);
    } catch (e) {
      console.error(e);
      alert('Failed to update task via drag-and-drop');
    }
  };

  const renderTasksForCategory = (categoryFilter: string) => {
    if (pipelineTasks === null) return <div style={{ padding: '0.5rem 0', color: 'var(--text-secondary)' }}>Loading...</div>;
    const catTasks = pipelineTasks.filter((t: any) => categoryFilter === 'Project Management' ? t.category === 'Project Management' || !t.category : t.category === categoryFilter);
    if (catTasks.length === 0) return <div style={{ padding: '0.5rem 0', color: 'var(--text-secondary)' }}>No tasks!</div>;
    
    // For List and Gantt, we filter out Done. For Kanban we keep it.
    const activeTasks = viewMode === 'kanban' ? catTasks : catTasks.filter((t: any) => t.status !== 'Done');

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <button onClick={() => setViewMode('list')} className={`btn ${viewMode === 'list' ? 'active' : ''}`} style={{ background: viewMode === 'list' ? 'rgba(255,255,255,0.1)' : 'transparent', padding: '0.25rem 0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <List size={14} /> List
          </button>
          <button onClick={() => setViewMode('kanban')} className={`btn ${viewMode === 'kanban' ? 'active' : ''}`} style={{ background: viewMode === 'kanban' ? 'rgba(255,255,255,0.1)' : 'transparent', padding: '0.25rem 0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Kanban size={14} /> Kanban
          </button>
          <button onClick={() => setViewMode('gantt')} className={`btn ${viewMode === 'gantt' ? 'active' : ''}`} style={{ background: viewMode === 'gantt' ? 'rgba(255,255,255,0.1)' : 'transparent', padding: '0.25rem 0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <BarChart size={14} /> Timeline
          </button>
        </div>

        {viewMode === 'kanban' && <KanbanView tasks={catTasks} onTaskClick={setSelectedTask} onTaskUpdate={updateTaskInSheet} />}
        {viewMode === 'gantt' && <GanttView tasks={activeTasks} onTaskClick={setSelectedTask} onTaskUpdate={updateTaskInSheet} />}
        
        {viewMode === 'list' && (() => {
          const sortedTasks = [...activeTasks].sort((a, b) => {
            const today = new Date().toISOString().split('T')[0];
            const aOverdue = a.dueDate !== 'TBD' && a.dueDate < today;
            const bOverdue = b.dueDate !== 'TBD' && b.dueDate < today;
            if (aOverdue && !bOverdue) return -1;
            if (!aOverdue && bOverdue) return 1;

            const aDueToday = a.dueDate !== 'TBD' && a.dueDate === today;
            const bDueToday = b.dueDate !== 'TBD' && b.dueDate === today;
            if (aDueToday && !bDueToday) return -1;
            if (!aDueToday && bDueToday) return 1;

            const aPriority = parseInt(a.priority?.replace(/\D/g, '') || '99');
            const bPriority = parseInt(b.priority?.replace(/\D/g, '') || '99');
            if (aPriority < bPriority) return -1;
            if (aPriority > bPriority) return 1;

            return 0;
          });

          return (
            <>
              {sortedTasks.slice(0, 5).map((t, idx) => {
                const today = new Date().toISOString().split('T')[0];
                const isOverdue = t.dueDate !== 'TBD' && t.dueDate < today;
                const isDueToday = t.dueDate !== 'TBD' && t.dueDate === today;
                return (
                  <div key={idx} className="list-item" style={{ borderLeft: isOverdue ? '3px solid var(--danger)' : isDueToday ? '3px solid #f59e0b' : 'none', cursor: 'pointer' }} onClick={() => setSelectedTask(t)}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 500, color: '#fff' }}>
                        {t.sourceUrl ? <a href={t.sourceUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: '#fff', textDecoration: 'underline decoration-1 underline-offset-2' }}>{t.task}</a> : t.task}
                      </span>
                      <span style={{ fontSize: '0.8rem', marginTop: '0.2rem', color: 'var(--text-secondary)' }}>
                        Assignee: {t.assignee} | Priority: {t.priority} {t.dueDate !== 'TBD' ? `| Due: ${new Date(t.dueDate).toLocaleDateString('en-GB')}` : ''}
                      </span>
                    </div>
                    {isOverdue && <span className="tag" style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)' }}>Overdue</span>}
                    {isDueToday && <span className="tag" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>Due Today</span>}
                  </div>
                );
              })}
              {sortedTasks.length > 5 && (
                <div style={{ padding: '0.5rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center' }}>
                  + {sortedTasks.length - 5} more tasks
                </div>
              )}
            </>
          );
        })()}
      </div>
    );
  };

  return (
    <>
      <header className="header glass-panel" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
        </div>
        <div className="tabs">
          {['Operations', 'Product Build', 'Project Management', 'HR', 'Finance', 'Industry', 'Marketing'].map(tab => (
            <button 
              key={tab} 
              className={`tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      <main className="dashboard">
        {activeTab === 'Product Build' && (
          <>
        <div className="card glass-panel">
          <div className="card-header">
            <Activity color="#38bdf8" size={24} />
            Antigravity Orchestrator
          </div>
          <div className="card-content">
            <span className="metric">{activeAgents ? activeAgents.length : '...'} Agents Active</span>
            <p style={{ marginTop: '0.5rem' }}>Moltbot is currently managing background infrastructure operations autonomously.</p>
            <div style={{ marginTop: '1.5rem' }}>
              {activeAgents === null && !orchestratorError && (
                <div style={{ padding: '0.5rem 0', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Connecting to Orchestrator...
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', animation: 'pulse-danger 2s infinite' }}></div>
                </div>
              )}
              {orchestratorError && (
                <div style={{ padding: '0.5rem 0', color: 'var(--danger)', fontSize: '0.9rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <X size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontWeight: 500 }}>Connection stuck or failed</div>
                    <div style={{ opacity: 0.8, fontSize: '0.8rem', marginTop: '0.2rem' }}>{orchestratorError} - Is Moltbot running on port 3000?</div>
                  </div>
                </div>
              )}
              {activeAgents && activeAgents.length === 0 && (
                <div style={{ padding: '0.5rem 0', color: 'var(--text-secondary)' }}>No agents currently active.</div>
              )}
              {activeAgents && (() => {
                if (activeAgents.length === 0) {
                  return <div style={{ padding: '0.5rem 0', color: 'var(--text-secondary)' }}>No agents currently active.</div>;
                }
                const filteredAgents = activeAgents.filter(a => !(a.workspace || '').includes('Alewood-PA'));
                if (filteredAgents.length === 0) {
                  return <div style={{ padding: '0.5rem 0', color: 'var(--text-secondary)' }}>No agents currently active in other workspaces.</div>;
                }
                const grouped: Record<string, any[]> = {};
                filteredAgents.forEach(a => {
                  const ws = a.workspace || 'Unknown Workspace';
                  if (!grouped[ws]) grouped[ws] = [];
                  grouped[ws].push(a);
                });
                return Object.keys(grouped).map(ws => (
                  <div key={ws} style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.75rem', fontWeight: 600, letterSpacing: '0.05em' }}>{ws}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {grouped[ws].map((agent: any) => {
                        const originalIdx = activeAgents.findIndex(a => a.id === agent.id);
                        return (
                          <div 
                            className="list-item" 
                            key={agent.id}
                            style={{ 
                              cursor: agent.requiresAction ? 'pointer' : 'default',
                              border: agent.requiresAction ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid transparent',
                              transition: 'all 0.2s',
                              margin: 0
                            }}
                            onClick={() => {
                              if (agent.requiresAction) {
                                const promptText = `[${agent.name}]\n\nThe agent is currently paused with status: ${agent.status}\n\n` +
                                  (agent.lastMessage ? `Agent's Request:\n"${agent.lastMessage}"\n\n` : '') +
                                  `Please provide your input or approval to continue:`;
                                const response = prompt(promptText);
                                if (response) {
                                  sendDirectMessage(`[Forward to ${agent.name}]: ${response}`);
                                  
                                  // Optimistically update the UI
                                  const newAgents = [...activeAgents];
                                  if (originalIdx !== -1) {
                                    newAgents[originalIdx].requiresAction = false;
                                    newAgents[originalIdx].status = 'Processing Request...';
                                    setActiveAgents(newAgents);
                                  }
                                }
                              }
                            }}
                            onMouseOver={(e) => {
                              if (agent.requiresAction) e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)';
                            }}
                            onMouseOut={(e) => {
                              if (agent.requiresAction) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {agent.requiresAction && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--danger)', animation: 'pulse-danger 2s infinite' }}></div>}
                              <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{agent.name}</span>
                            </div>
                            <span className="tag" style={{ 
                              background: agent.requiresAction ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', 
                              color: agent.requiresAction ? 'var(--danger)' : 'var(--success)', 
                              maxWidth: '160px', 
                              whiteSpace: 'nowrap', 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis' 
                            }} title={agent.status}>
                              {agent.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
          <button className="btn" onClick={() => handleCommand('Spawn a new Antigravity agent')}>
            <Play size={18} />
            Spawn New Agent
          </button>
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
                      {activity.commit?.author?.name || 'System'} • {new Date(activity.commit?.author?.date).toLocaleDateString('en-GB')}
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

        <div className="card glass-panel" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <CheckCircle color="#38bdf8" size={24} />
            Product Build Tasks
          </div>
          <div className="card-content">
            <div style={{ marginTop: '0.5rem' }}>
              {renderTasksForCategory('Product Build')}
            </div>
          </div>
        </div>
        </>
        )}

        {activeTab === 'Project Management' && (
          <>
          <div className="card glass-panel">
            <div className="card-header">
              <CheckCircle color="#10b981" size={24} />
              Pipeline Tasks
            </div>
            <div className="card-content">
              <span className="metric">{pipelineTasks === null ? 'Loading...' : `${pipelineTasks.filter((t: any) => t.category === 'Project Management' || !t.category).length} Pending Tasks`}</span>
              <p style={{ marginTop: '0.5rem' }}>Tasks extracted from your brain dumps and NotebookLM.</p>
              <div style={{ marginTop: '1.5rem' }}>
                {renderTasksForCategory('Project Management')}
              </div>
            </div>
            <a 
              href="https://docs.google.com/spreadsheets/d/1yskd_H80YpKH5pW1vwpVVyIi49Ce86m87VQP99VJ2mw/edit" 
              target="_blank" 
              rel="noreferrer" 
              className="btn" 
              style={{ background: '#10b981', textDecoration: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            >
              Open Master Pipeline
            </a>
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
                      Ingested • {new Date(file.modifiedTime).toLocaleDateString('en-GB')}
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
        </>
        )}

        {activeTab === 'Operations' && (
          <>
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
                    <div key={email.id} className="list-item" style={{ alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, paddingRight: '0.5rem' }}>
                        <span style={{ fontWeight: 500, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email.subject}</span>
                        <span style={{ fontSize: '0.8rem', marginTop: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>From: {email.from}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                        {idx === 0 && <span className="tag" style={{ whiteSpace: 'nowrap' }}>Action Required</span>}
                        <button 
                          className="icon-btn" 
                          style={{ padding: '0.4rem', background: 'rgba(255,255,255,0.1)', borderRadius: '0.25rem' }} 
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              const token = localStorage.getItem('googleAccessToken');
                              await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.id}/modify`, {
                                method: 'POST',
                                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ removeLabelIds: ['INBOX', 'UNREAD'] })
                              });
                              setLatestEmails(prev => prev.filter(em => em.id !== email.id));
                              setUnreadCount(prev => prev !== null ? prev - 1 : null);
                            } catch (err) { console.error("Archive failed", err); }
                          }}
                          title="Archive"
                        >
                          <Archive size={16} color="#64748b" />
                        </button>
                        <button 
                          className="icon-btn" 
                          style={{ padding: '0.4rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '0.25rem' }} 
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              const token = localStorage.getItem('googleAccessToken');
                              await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.id}/trash`, {
                                method: 'POST',
                                headers: { Authorization: `Bearer ${token}` }
                              });
                              setLatestEmails(prev => prev.filter(em => em.id !== email.id));
                              setUnreadCount(prev => prev !== null ? prev - 1 : null);
                            } catch (err) { console.error("Delete failed", err); }
                          }}
                          title="Delete"
                        >
                          <Trash2 size={16} color="var(--danger)" />
                        </button>
                      </div>
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
              <SchedulePane 
                meetings={meetings} 
                error={calendarError} 
                onEventClick={(m) => setSelectedEvent(m)} 
                onNewEvent={() => setSelectedEvent({})} 
              />
            </div>

            <div className="card glass-panel" style={{ gridColumn: '1 / -1' }}>
              <div className="card-header">
                <CheckCircle color="#38bdf8" size={24} />
                Operations Tasks
              </div>
              <div className="card-content">
                <div style={{ marginTop: '0.5rem' }}>
                  {renderTasksForCategory('Operations')}
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'HR' && (
          <div className="card glass-panel" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header">
              <Users color="#ec4899" size={24} />
              Human Resources Hub
            </div>
            <div className="card-content">
              <span className="metric">Team Pulse</span>
              <p style={{ marginTop: '0.5rem' }}>Manage recruitment tasks, holiday management, and employee performance reviews.</p>
              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div className="list-item" style={{ flex: 1, minWidth: '250px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 500, color: '#fff' }}>Pending Leave Requests</span>
                    <span style={{ fontSize: '0.8rem', marginTop: '0.2rem', color: 'var(--text-secondary)' }}>2 waiting for approval</span>
                  </div>
                  <button className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', marginTop: 0 }}>Review</button>
                </div>
                <div className="list-item" style={{ flex: 1, minWidth: '250px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 500, color: '#fff' }}>Active Recruitment</span>
                    <span style={{ fontSize: '0.8rem', marginTop: '0.2rem', color: 'var(--text-secondary)' }}>Senior Field Agent - 3 Interviews</span>
                  </div>
                  <button className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', marginTop: 0, background: 'var(--text-secondary)' }}>View</button>
                </div>
              </div>
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#ec4899' }}>HR Tasks</h3>
                {renderTasksForCategory('HR')}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Finance' && (
          <div className="card glass-panel" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header">
              <PoundSterling color="#10b981" size={24} />
              Finance Operations
            </div>
            <div className="card-content">
              <span className="metric">Financial Health</span>
              <p style={{ marginTop: '0.5rem' }}>Pricing configurations, invoicing workflows, and contract/licence agreements.</p>
              <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                 <div style={{ padding: '1.5rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '0.5rem', textAlign: 'center' }}>
                   <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#fff' }}>£42.5k</div>
                   <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Pending Invoices</div>
                 </div>
                 <div style={{ padding: '1.5rem', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '0.5rem', textAlign: 'center' }}>
                   <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#fff' }}>3</div>
                   <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Licences Expiring Soon</div>
                 </div>
              </div>
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#10b981' }}>Finance Tasks</h3>
                {renderTasksForCategory('Finance')}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Industry' && (
          <div className="card glass-panel" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Globe color="#38bdf8" size={24} />
                Market Intelligence
              </div>
              <button className="btn" style={{ background: 'rgba(255,255,255,0.1)', padding: '0.4rem 0.8rem', fontSize: '0.8rem', marginTop: 0 }} onClick={() => setShowIndustrySettings(true)}>
                Configure Tracking
              </button>
            </div>
            <div className="card-content">
              <span className="metric">Industry Pulse</span>
              <p style={{ marginTop: '0.5rem' }}>Relevant industry updates from LinkedIn and the web relating to competitors, customers, and potential customers.</p>
              
              <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {!industryUpdates ? (
                  <div style={{ padding: '1rem 0', color: 'var(--text-secondary)' }}>Scraping web for latest updates...</div>
                ) : industryUpdates.filter(u => !archivedUpdates.includes(u.url)).length === 0 ? (
                  <div style={{ padding: '1rem 0', color: 'var(--text-secondary)' }}>No recent news found for your tracked entities. Please configure tracking.</div>
                ) : (
                  industryUpdates.filter(u => !archivedUpdates.includes(u.url)).map((update: any) => (
                    <div key={update.id} className="list-item" style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.05)', display: 'block', cursor: 'pointer', transition: 'background 0.2s', position: 'relative' }} onClick={() => window.open(update.url, '_blank')} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'} onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {update.iconName === 'Users' ? <Users size={16} color="#0a66c2" /> : <Newspaper size={16} color="#10b981" />} {update.source} • {update.date}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="tag" style={{ background: `${update.tagColor}20`, color: update.tagColor, border: `1px solid ${update.tagColor}40` }}>
                            {update.tag}
                          </span>
                          <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', height: '16px', margin: '0 0.25rem' }}></div>
                          <button 
                            className="icon-btn" 
                            style={{ padding: '0.25rem', background: 'rgba(255,255,255,0.05)' }} 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              sendSilentCommand(`create task: Review industry update - ${update.headline.replace(/<[^>]+>/g, '')}`, { sourceUrl: update.url }); 
                              alert('Task created in Master Pipeline'); 
                            }}
                            title="Create Task"
                          >
                            <CheckSquare size={14} color="#38bdf8" />
                          </button>
                          <button 
                            className="icon-btn" 
                            style={{ padding: '0.25rem', background: 'rgba(255,255,255,0.05)' }} 
                            onClick={(e) => { e.stopPropagation(); setActiveTab('Marketing'); }}
                            title="Create Post"
                          >
                            <Share2 size={14} color="#f472b6" />
                          </button>
                          <button 
                            className="icon-btn" 
                            style={{ padding: '0.25rem', background: 'rgba(255,255,255,0.05)' }} 
                            onClick={(e) => { e.stopPropagation(); sendSilentCommand(`[Notebook Integration]: Add source URL to Master Notebook: ${update.url}`, { sourceUrl: update.url, headline: update.headline, snippet: update.snippet }); alert('Sent to NotebookLM'); }}
                            title="Send to Notebook"
                          >
                            <BookOpen size={14} color="#a78bfa" />
                          </button>
                          <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', height: '16px', margin: '0 0.25rem' }}></div>
                          <button 
                            className="icon-btn" 
                            style={{ padding: '0.25rem', background: 'rgba(255,255,255,0.05)' }} 
                            onClick={(e) => handleRateUpdate(e, update, true)}
                            title="Useful"
                          >
                            <ThumbsUp size={14} color="#10b981" />
                          </button>
                          <button 
                            className="icon-btn" 
                            style={{ padding: '0.25rem', background: 'rgba(255,255,255,0.05)' }} 
                            onClick={(e) => handleRateUpdate(e, update, false)}
                            title="Not Useful"
                          >
                            <ThumbsDown size={14} color="#ef4444" />
                          </button>
                          <button 
                            className="icon-btn" 
                            style={{ padding: '0.25rem', background: 'rgba(255,255,255,0.05)' }} 
                            onClick={(e) => handleArchiveUpdate(e, update.url)}
                            title="Archive"
                          >
                            <Archive size={14} color="#64748b" />
                          </button>
                        </div>
                      </div>
                      <div style={{ fontWeight: 500, color: '#fff', fontSize: '1.05rem', lineHeight: 1.4, paddingRight: '2rem' }} dangerouslySetInnerHTML={{ __html: update.headline }}>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Marketing' && <MarketingTab />}
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
          <button type="button" className={`chat-mic-btn ${isListening ? 'listening' : ''}`} onClick={startListening}>
            <Mic size={18} color={isListening ? "#ef4444" : "#fff"} />
          </button>
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
      {selectedTask && <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} onSave={handleTaskSave} />}
      {selectedEvent && <EventModal 
        event={selectedEvent} 
        onClose={() => setSelectedEvent(null)} 
        onSave={(updatedEvent, isNew) => {
          setMeetings(prev => {
            if (!prev) return [updatedEvent];
            if (isNew) return [...prev, updatedEvent].sort((a, b) => new Date(a.start?.dateTime || a.start?.date).getTime() - new Date(b.start?.dateTime || b.start?.date).getTime());
            return prev.map(m => m.id === updatedEvent.id ? updatedEvent : m);
          });
          setSelectedEvent(null);
        }} 
        onDelete={(eventId) => {
          setMeetings(prev => prev ? prev.filter(m => m.id !== eventId) : null);
          setSelectedEvent(null);
        }}
      />}
      {showIndustrySettings && <IndustrySettingsModal 
        onClose={() => setShowIndustrySettings(false)} 
        onSave={(config) => {
          setIndustryConfig(config);
          if (user) setDoc(doc(db, 'users', user.uid), { industryConfig: config }, { merge: true });
          setShowIndustrySettings(false);
        }} 
      />}
      
      {needsTokenRefresh && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content glass-panel" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Session Expired</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Your Google Workspace secure session has expired. Please refresh it to continue without losing your place.
            </p>
            <button className="btn" onClick={handleTokenRefresh} style={{ width: '100%', justifyContent: 'center' }}>
              Refresh Session
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default App
