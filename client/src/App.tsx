import { useState, useEffect } from 'react'
import { Mail, Calendar, BookOpen, Activity, Play, CheckCircle, MessageSquare, X, Send, LogOut, GitBranch, Bell, Mic, Users, PoundSterling, Kanban, List, BarChart, Globe, Newspaper, Archive, ThumbsUp, ThumbsDown, CheckSquare, Share2, Trash2, RefreshCw, Scale, Menu } from 'lucide-react'
import { doc, getDoc, setDoc, arrayUnion } from 'firebase/firestore'
import { app, auth, db, googleProvider } from './firebase'
import { onAuthStateChanged, type User, signOut, signInWithPopup, GoogleAuthProvider } from 'firebase/auth'
import { getFunctions, httpsCallable } from 'firebase/functions'
import LoginScreen from './LoginScreen'
import DraftsModal from './DraftsModal'
import TaskModal from './TaskModal'
import EventModal from './EventModal'
import IndustrySettingsModal from './IndustrySettingsModal'
import { KanbanView, GanttView } from './TaskViews'
import SchedulePane from './SchedulePane'
import MarketingTab from './MarketingTab'
import SalesTab from './SalesTab'
import FinancialDashboard from './FinancialDashboard'
import { MeetingRecorder } from './MeetingRecorder'
import { GeminiAssistant } from './geminiAssistant'
import ReceiptCameraModal from './ReceiptCameraModal'

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [showDrafts, setShowDrafts] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [activeTab, setActiveTab] = useState(localStorage.getItem('activeTab') || 'Operations');
  const [drawerOpen, setDrawerOpen] = useState(false);
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
    { role: 'bot', text: 'Hi! I am Moltbot. How can I help you today?' }
  ]);
  const [isTaskFlowActive, setIsTaskFlowActive] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState(localStorage.getItem('geminiApiKey') || '');
  const [geminiInputKey, setGeminiInputKey] = useState('');
  const [assistant, setAssistant] = useState<GeminiAssistant | null>(null);
  
  const [expenses, setExpenses] = useState<any[]>([]);
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const [scannedExpense, setScannedExpense] = useState<any>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [isSyncingEmails, setIsSyncingEmails] = useState(false);
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseFilterType, setExpenseFilterType] = useState('All');
  const [expenseSort, setExpenseSort] = useState('Newest');
  useEffect(() => {
    if (geminiApiKey) {
      setAssistant(new GeminiAssistant(geminiApiKey));
    }
  }, [geminiApiKey]);

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  const [noteText, setNoteText] = useState('');
  const [uploadingNote, setUploadingNote] = useState(false);
  const [pipelineTasks, setPipelineTasks] = useState<any[] | null>(null);
  const [activeAgents, setActiveAgents] = useState<any[] | null>(null);
  const [orchestratorError, setOrchestratorError] = useState<string | null>(null);
  const [industryConfig, setIndustryConfig] = useState<any>(null);
  const [industryUpdates, setIndustryUpdates] = useState<any[] | null>(null);
  const [archivedUpdates, setArchivedUpdates] = useState<string[]>(() => {
    const saved = localStorage.getItem('archivedIndustryUpdates');
    return saved ? JSON.parse(saved).map(String) : [];
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
              const strArchived = data.archivedUpdates.map(String);
              setArchivedUpdates(strArchived);
              localStorage.setItem('archivedIndustryUpdates', JSON.stringify(strArchived));
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

    const fetchExpensesFromSheets = async () => {
      const token = localStorage.getItem('googleAccessToken');
      if (!token) return;
      try {
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/1AQZ854Zx8KCRG9EpiK0WnEuucI2qW7I-cQb1-k0fjP0/values/Transactions!A:N`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const sheetData = await res.json();
        if (sheetData.values && sheetData.values.length > 1) {
          const rows = sheetData.values.slice(1);
          const parsedExpenses = rows.map((row: any, idx: number) => ({
            rowIndex: idx + 2, // 1 for 1-based index, +1 for header
            date: row[0] || '',
            reference: row[1] || '',
            type: row[2] || '',
            category: row[3] || '',
            supplier: row[4] || '',
            vatNumber: row[5] || '',
            description: row[6] || '',
            grossAmount: row[7] || '',
            vatAmount: row[8] || '',
            netAmount: row[9] || '',
            paymentMethod: row[10] || '',
            receiptLink: row[12] || '',
            distance: row[13] || ''
          })).filter((exp: any) => exp.reference || exp.supplier); // filter out empty rows
          setExpenses(parsedExpenses);
        }
      } catch (err) {
        console.error("Failed to fetch expenses from Sheets", err);
      }
    };
    fetchExpensesFromSheets();
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
          const merged = [...data.updates, ...prevUpdates];
          
          const seen = new Set();
          const uniqueUpdates = merged.filter((u: any) => {
             const cleanHeadline = String(u.headline || '').replace(/<[^>]+>/g, '').replace(/&[#a-z0-9]+;/gi, '').replace(/[^a-z0-9]/gi, '').trim().toLowerCase();
             const baseUrl = String(u.url || '').split('?')[0].trim().toLowerCase();
             const keyHeadline = String(u.headline || '').replace(/[^a-z0-9]/gi, '').trim().toLowerCase();
             const keyUrl = String(u.url || '').trim().toLowerCase();
             
             if ((baseUrl && seen.has(baseUrl)) || (cleanHeadline && seen.has(cleanHeadline))) {
               return false;
             }
             if (baseUrl) seen.add(baseUrl);
             if (keyUrl) seen.add(keyUrl);
             if (cleanHeadline) seen.add(cleanHeadline);
             if (keyHeadline) seen.add(keyHeadline);
             return true;
          });

          uniqueUpdates.sort((a, b) => b.timestamp - a.timestamp);
          const finalUpdates = uniqueUpdates.slice(0, 50);
          
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
            fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`, {
              headers: { Authorization: `Bearer ${token}` }
            }).then(r => r.json())
          )).then(msgs => {
            const parsed = msgs.map((m: any) => {
              const headers = m.payload?.headers || [];
              const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
              const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown';
              const dateHeader = headers.find((h: any) => h.name === 'Date')?.value || '';
              const receivedAt = m.internalDate ? new Date(parseInt(m.internalDate)).toLocaleString('en-GB') : (dateHeader ? new Date(dateHeader).toLocaleString('en-GB') : 'Unknown Date');
              
              let isInvite = false;
              let icsData = null;
              
              const checkParts = (parts: any[]) => {
                for (const part of parts) {
                  if (part.mimeType === 'text/calendar' || part.mimeType === 'application/ics') {
                    isInvite = true;
                    if (part.body && part.body.data) {
                      try {
                        icsData = decodeURIComponent(escape(atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'))));
                      } catch (e) {
                        console.error('Failed to decode ICS data', e);
                      }
                    }
                  } else if (part.parts) {
                    checkParts(part.parts);
                  }
                }
              };
              
              if (m.payload?.parts) {
                checkParts(m.payload.parts);
              } else if (m.payload?.mimeType === 'text/calendar') {
                  isInvite = true;
                  if (m.payload.body && m.payload.body.data) {
                      try {
                          icsData = decodeURIComponent(escape(atob(m.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'))));
                      } catch (e) {}
                  }
              }

              return { id: m.id, subject, from, snippet: m.snippet, receivedAt, isInvite, icsData };
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
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/1yskd_H80YpKH5pW1vwpVVyIi49Ce86m87VQP99VJ2mw/values/Pipeline!A:J`, {
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
          const tasks = data.values.slice(1).map((row: any, idx: number) => {
            const normalize = (val: any, defaultVal: string, mapObj: any = {}) => {
              if (!val) return defaultVal;
              const clean = String(val).trim();
              if (clean === "") return defaultVal;
              const lower = clean.toLowerCase();
              return mapObj[lower] || clean;
            };

            return {
              id: idx + 2, // Row index in Google Sheets
              rowIdx: idx + 2,
              task: row[0] ? String(row[0]).trim() : "",
              assignee: row[1] ? String(row[1]).trim() || "Unassigned" : "Unassigned",
              priority: normalize(row[2], 'Medium', { 'low': 'Low', 'medium': 'Medium', 'high': 'High' }),
              status: normalize(row[3], 'Open', { 'open': 'Open', 'in progress': 'In Progress', 'blocked': 'Blocked', 'done': 'Done' }),
              dueDate: row[4] ? String(row[4]).trim() || 'TBD' : 'TBD',
              sourceUrl: row[5] || null,
              category: normalize(row[6], 'Project Management', { 
                'hr': 'HR', 'operations': 'Operations', 'finance': 'Finance', 'legal': 'Legal', 
                'product build': 'Product Build', 'project management': 'Project Management' 
              }),
              createdAt: row[7] || null,
              completedAt: row[8] || null,
              comments: row[9] || ''
            };
          }).filter((t: any) => t.task !== "");
          
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



  const handleArchiveUpdate = (e: React.MouseEvent, updateToArchive: any) => {
    e.stopPropagation();
    let cleanHeadline = '';
    let baseUrl = '';
    try {
      cleanHeadline = String(updateToArchive.headline || '').replace(/<[^>]+>/g, '').replace(/&[#a-z0-9]+;/gi, '').replace(/[^a-z0-9]/gi, '').trim().toLowerCase();
      baseUrl = String(updateToArchive.url || '').split('?')[0].trim().toLowerCase();
    } catch (err) {
      console.error('[ARCHIVE DEBUG] Error coercing strings', err);
    }
    const idsToArchive = [
      updateToArchive.id ? String(updateToArchive.id) : null, 
      updateToArchive.url ? String(updateToArchive.url) : null, 
      updateToArchive.headline ? String(updateToArchive.headline) : null, 
      cleanHeadline, 
      baseUrl
    ].filter(Boolean) as string[];

    console.log('[ARCHIVE DEBUG] Archiving update:', updateToArchive);
    console.log('[ARCHIVE DEBUG] Identifiers added to blocklist:', idsToArchive);
    
    setArchivedUpdates(prev => {
      const newArchived = [...prev, ...idsToArchive];
      localStorage.setItem('archivedIndustryUpdates', JSON.stringify(newArchived));
      if (user) {
        setDoc(doc(db, 'users', user.uid), { archivedUpdates: newArchived }, { merge: true });
      }
      return newArchived;
    });
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
      handleArchiveUpdate(e, update); // Archive it after rating if not useful
    }
  };

  const handleCommand = async (cmd: string = message) => {
    setChatOpen(true);
    setMessage(cmd);
  };

  const sendDirectMessage = async (userMessage: string) => {
    if (!assistant && geminiApiKey) return;
    setChatOpen(true);
    setChatHistory(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsChatLoading(true);
    
    try {
      if (!assistant) throw new Error("Assistant not initialized");
      let response = await assistant.sendMessage(userMessage);
      
      if (response.functionCalls && response.functionCalls.length > 0) {
        const functionCall = response.functionCalls[0];
        if (functionCall.name === 'create_meeting') {
          const args = functionCall.args as any;
          setChatHistory(prev => [...prev, { role: 'bot', text: `Creating meeting: ${args.title}...` }]);
          
          const token = localStorage.getItem('googleAccessToken');
          if (!token) {
             response = await assistant.sendToolResponse([{
               functionResponse: { name: 'create_meeting', response: { error: 'No Google Calendar token found. Please sign in.' } }
             }]);
          } else {
            const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                summary: args.title,
                description: args.description || '',
                start: { dateTime: args.startDateTime },
                end: { dateTime: args.endDateTime }
              })
            });
            const data = await res.json();
            const toolResponse = res.ok ? { success: true, eventLink: data.htmlLink } : { error: data.error?.message || 'Failed' };
            response = await assistant.sendToolResponse([{
               functionResponse: { name: 'create_meeting', response: toolResponse }
            }]);
          }
        }
      }
      if (response.text) {
        setChatHistory(prev => [...prev, { role: 'bot', text: response.text }]);
      }
    } catch (err) {
      console.error(err);
      setChatHistory(prev => [...prev, { role: 'bot', text: 'Error connecting to Gemini. Please check your API key.' }]);
    } finally {
      setIsChatLoading(false);
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
      processCommand(transcript);
    };
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    
    recognition.start();
  };

  const processCommand = async (userMessage: string) => {
    setChatHistory(prev => [...prev, { role: 'user', text: userMessage }]);
    
    const lowerMsg = userMessage.toLowerCase();
    const isTaskIntent = lowerMsg.includes('create task') || lowerMsg.includes('task') || lowerMsg.includes('remind me') || lowerMsg.includes('todo');
    
    if (isTaskFlowActive || isTaskIntent) {
      setIsTaskFlowActive(true);
      try {
        const token = localStorage.getItem('googleAccessToken');
        const res = await fetch('https://alewood-moltbot-343832934198.europe-west2.run.app/api/orchestrator/conversational-task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            chatHistory: [...chatHistory, { role: 'user', text: userMessage }],
            token,
            activeTab
          })
        });
        const data = await res.json();
        setChatHistory(prev => [...prev, { role: 'bot', text: data.message }]);
        if (data.taskCreated) {
           setIsTaskFlowActive(false);
           // Trigger a refresh event for the CRM tab so it immediately shows the new task
           window.dispatchEvent(new Event('crm-updated'));
        }
      } catch (err) {
        console.error(err);
        setChatHistory(prev => [...prev, { role: 'bot', text: `Failed to connect to the orchestrator for task creation.` }]);
        setIsTaskFlowActive(false);
      }
      return;
    }

    if (lowerMsg.includes('activity record') || lowerMsg.includes('log activity') || lowerMsg.includes('meeting with')) {
      const match = userMessage.match(/(?:activity record for|log activity for|meeting with)\s+([A-Za-z\s]+?)\s+(I\'ve|I have|We|Discussed|About|And)(.*)/i);
      let personName = '';
      let notes = '';
      
      if (match) {
        personName = match[1].trim();
        notes = (match[2] + match[3]).trim();
      } else {
        const parts = userMessage.split(/activity record for|log activity for|meeting with/i);
        if (parts.length > 1) {
          const remainder = parts[1].trim();
          const words = remainder.split(' ');
          personName = words.slice(0, 2).join(' ');
          notes = words.slice(2).join(' ');
        }
      }

      if (personName && notes) {
        try {
          const token = localStorage.getItem('googleAccessToken');
          if (token) {
            const SALES_SPREADSHEET_ID = '1_DvYuIUkKy903wKlRHeR953RsGBLynDu5bhBZ72yCO0';
            
            const sheetRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SALES_SPREADSHEET_ID}/values/Activities!A:AZ`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            const sheetData = await sheetRes.json();
            const rows = sheetData.values || [];
            const headers = rows.length > 0 ? rows[0] : ['Date', 'Person', 'Company', 'Type', 'Notes'];
            const targetRow = rows.length + 1;
            
            const newActivityObj: any = {
              person: personName,
              company: '',
              type: 'Meeting',
              date: new Date().toLocaleDateString('en-GB'),
              notes: notes
            };

            const rowData = headers.map((header: string) => {
              const key = header.toLowerCase().replace(/\s+/g, '');
              return newActivityObj[key] || '';
            });

            await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SALES_SPREADSHEET_ID}/values/Activities!A${targetRow}?valueInputOption=USER_ENTERED`, {
              method: 'PUT',
              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ values: [rowData] })
            });
            
            setChatHistory(prev => [...prev, { role: 'bot', text: `Got it! I have logged the activity record for ${personName}.` }]);
            return;
          }
        } catch (err) {
          console.error(err);
        }
      }
    }
    
    if (activeTab === 'Sales' && (lowerMsg.includes('add') || lowerMsg.includes('update') || lowerMsg.includes('set') || lowerMsg.includes('change'))) {
      const match = userMessage.match(/(?:add|update|set|change)\s+(?:this\s+)?(.*?)\s+(?:to|for|on|in)(?: the)?\s+(.*?)(?:\s+record)?(?:\s*:\s*|\s+to\s+)(.*)/i);
      
      if (match) {
        const fieldQuery = match[1].toLowerCase().trim().replace(/this\s+/g, '').replace(/the\s+/g, '');
        const recordName = match[2].trim();
        const fieldValue = match[3].trim();

        try {
          const token = localStorage.getItem('googleAccessToken');
          if (token) {
            const SALES_SPREADSHEET_ID = '1_DvYuIUkKy903wKlRHeR953RsGBLynDu5bhBZ72yCO0';
            
            const tables = [
              { name: 'Opportunities', headerRow: 2, nameKeys: ['opportunityname', 'title', 'name'] },
              { name: 'People', headerRow: 2, nameKeys: ['name', 'fullname', 'person'] },
              { name: 'Companies', headerRow: 2, nameKeys: ['companyname', 'name'] }
            ];

            let foundUpdate = false;

            for (const table of tables) {
              const sheetRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SALES_SPREADSHEET_ID}/values/${table.name}!A:AZ`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              const sheetData = await sheetRes.json();
              const rows = sheetData.values || [];
              
              if (rows.length > table.headerRow) {
                const headers = rows[table.headerRow];
                
                let nameIdx = -1;
                let targetIdx = -1;
                
                headers.forEach((h: string, i: number) => {
                  const key = (h || '').toLowerCase().replace(/\s+/g, '');
                  
                  if (table.nameKeys.includes(key)) nameIdx = i;
                  
                  const cleanH = (h || '').toLowerCase();
                  if (
                    cleanH === fieldQuery || 
                    key === fieldQuery.replace(/\s+/g, '') ||
                    (fieldQuery.includes('number') && (key.includes('phone') || key.includes('mobile'))) ||
                    (fieldQuery.includes('phone') && (key.includes('phone') || key.includes('mobile'))) ||
                    (fieldQuery.includes('email') && key.includes('email')) ||
                    (fieldQuery.includes('role') && key.includes('title'))
                  ) {
                    targetIdx = i;
                  }
                });

                if (nameIdx !== -1 && targetIdx !== -1) {
                  let foundRowIdx = -1;
                  let foundRowData: any[] = [];
                  for (let i = table.headerRow + 1; i < rows.length; i++) {
                    if (rows[i][nameIdx] && rows[i][nameIdx].toLowerCase() === recordName.toLowerCase()) {
                      foundRowIdx = i;
                      foundRowData = [...rows[i]];
                      break;
                    }
                  }

                  if (foundRowIdx !== -1) {
                    while (foundRowData.length <= targetIdx) {
                      foundRowData.push('');
                    }
                    foundRowData[targetIdx] = fieldValue;
                    const targetRow = foundRowIdx + 1;

                    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SALES_SPREADSHEET_ID}/values/${table.name}!A${targetRow}?valueInputOption=USER_ENTERED`, {
                      method: 'PUT',
                      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ values: [foundRowData] })
                    });
                    
                    setChatHistory(prev => [...prev, { role: 'bot', text: `Success! I've updated the ${headers[targetIdx]} to "${fieldValue}" on the ${recordName} record in ${table.name}.` }]);
                    foundUpdate = true;
                    break;
                  }
                }
              }
            }

            if (foundUpdate) return;
            
            setChatHistory(prev => [...prev, { role: 'bot', text: `I couldn't find a matching record for "${recordName}" or a column matching "${fieldQuery}" across the CRM.` }]);
            return;
          }
        } catch (err) {
          console.error(err);
        }
      }
    }
    
    // Only Sales logic above this point. If on Sales tab and no match, respond generically.
    if (activeTab === 'Sales') {
      setChatHistory(prev => [...prev, { role: 'bot', text: 'I am your Gemini Sales Assistant. You can ask me to "Log an activity for [Name] [Notes]", "Add this email to [Name] record: [Email]", or "Create task: [Task Details]".' }]);
      return;
    }

    // Call the Gemini Assistant for anything else
    try {
      if (!assistant) throw new Error("Assistant not initialized");
      setIsChatLoading(true);
      let response = await assistant.sendMessage(userMessage);
      
      if (response.functionCalls && response.functionCalls.length > 0) {
        const functionCall = response.functionCalls[0];
        if (functionCall.name === 'create_meeting') {
          const args = functionCall.args as any;
          setChatHistory(prev => [...prev, { role: 'bot', text: `Creating meeting: ${args.title}...` }]);
          
          const token = localStorage.getItem('googleAccessToken');
          if (!token) {
             response = await assistant.sendToolResponse([{
               functionResponse: { name: 'create_meeting', response: { error: 'No Google Calendar token found. Please sign in.' } }
             }]);
          } else {
            const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                summary: args.title,
                description: args.description || '',
                start: { dateTime: args.startDateTime },
                end: { dateTime: args.endDateTime }
              })
            });
            const data = await res.json();
            const toolResponse = res.ok ? { success: true, eventLink: data.htmlLink } : { error: data.error?.message || 'Failed' };
            response = await assistant.sendToolResponse([{
               functionResponse: { name: 'create_meeting', response: toolResponse }
            }]);
          }
        }
        else if (functionCall.name === 'create_task') {
          const args = functionCall.args as any;
          setChatHistory(prev => [...prev, { role: 'bot', text: `Creating task: ${args.taskName}...` }]);
          
          const token = localStorage.getItem('googleAccessToken');
          if (!token) {
             response = await assistant.sendToolResponse([{
               functionResponse: { name: 'create_task', response: { error: 'No Google Sheets token found. Please sign in.' } }
             }]);
          } else {
             try {
                if (args.context === 'CRM') {
                  const CRM_SPREADSHEET_ID = '1_DvYuIUkKy903wKlRHeR953RsGBLynDu5bhBZ72yCO0';
                  const dateStr = new Date().toLocaleDateString('en-GB');
                  const rowData = [
                    dateStr,
                    args.person || '-',
                    args.company || '-',
                    args.dueDate || 'TBD',
                    args.taskName || 'Untitled Task',
                    'Open'
                  ];
                  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CRM_SPREADSHEET_ID}/values/Tasks!A:F:append?valueInputOption=USER_ENTERED`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ values: [rowData] })
                  });
                } else {
                  // Wait, I need to fetch the Master Pipeline ID from backend, but the frontend doesn't have it easily accessible unless it asks Moltbot.
                  // However, previously `create task:` regex logic used to send it to the orchestrator.
                  // Wait, if it's Project, let's just use the Orchestrator command API.
                  await fetch('https://alewood-moltbot-343832934198.europe-west2.run.app/api/orchestrator/command', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ command: `create task: ${args.taskName}`, token, activeTab })
                  });
                }
                
                response = await assistant.sendToolResponse([{
                   functionResponse: { name: 'create_task', response: { success: true } }
                }]);
                window.dispatchEvent(new Event('crm-updated'));
             } catch(err: any) {
                response = await assistant.sendToolResponse([{
                   functionResponse: { name: 'create_task', response: { error: err.message } }
                }]);
             }
          }
        }
        else if (functionCall.name === 'record_expense') {
          const args = functionCall.args as any;
          setChatHistory(prev => [...prev, { role: 'bot', text: `Recording expense: £${args.amount} for ${args.supplier}...` }]);
          try {
            const newExpense = {
              id: Date.now().toString(),
              date: new Date().toISOString(),
              supplier: args.supplier || '',
              amount: args.amount || '0.00',
              vat: args.vat || '0.00',
              type: args.type || 'Other',
              category: args.category || 'Other',
              distance: args.distance || null
            };
            const docRef = doc(db, 'users', user!.uid);
            await setDoc(docRef, { expenses: arrayUnion(newExpense) }, { merge: true });
            setExpenses(prev => [...prev, newExpense]);
            response = await assistant.sendToolResponse([{
               functionResponse: { name: 'record_expense', response: { success: true } }
            }]);
          } catch(err: any) {
             response = await assistant.sendToolResponse([{
               functionResponse: { name: 'record_expense', response: { error: err.message } }
             }]);
          }
        }
      }
      if (response.text) {
        setChatHistory(prev => [...prev, { role: 'bot', text: response.text }]);
      }
    } catch (err) {
      console.error(err);
      setChatHistory(prev => [...prev, { role: 'bot', text: 'Error connecting to Gemini. Please check your API key.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    const userMessage = message;
    setMessage('');
    
    await processCommand(userMessage);
  };
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
        completedAt,
        taskToSave.comments || ""
      ]];

      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Pipeline!A${rowIdx}:J${rowIdx}?valueInputOption=USER_ENTERED`, {
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

  const categoryMatches = (taskCategory: string, filterStr: string) => {
    const cat = (taskCategory || 'Project Management').trim().toLowerCase();
    const filter = filterStr.trim().toLowerCase();
    
    if (filter === 'project management') return cat === 'project management';
    if (filter === 'operations') return cat === 'operations' || cat === 'company setup' || cat === 'sales' || cat.includes('marketing') || cat.includes('pr');
    if (filter === 'hr') return cat === 'hr' || cat === 'recruitment';
    if (filter === 'legal') return cat === 'legal' || cat === 'security & compliance' || cat.includes('compliance');
    if (filter === 'product build') return cat.includes('product build');
    
    return cat === filter;
  };

  const renderTasksForCategory = (categoryFilter: string) => {
    if (pipelineTasks === null) return <div style={{ padding: '0.5rem 0', color: 'var(--text-secondary)' }}>Loading...</div>;
    const catTasks = pipelineTasks.filter((t: any) => categoryMatches(t.category, categoryFilter));
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

          if (sortedTasks.length === 0) {
            return <div style={{ padding: '1rem', color: 'var(--text-secondary)' }}>No active tasks to display.</div>;
          }

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

  const syncEmailReceipts = async () => {
    setIsSyncingEmails(true);
    const token = localStorage.getItem('googleAccessToken');
    if (!token) {
      alert('Please reconnect Google to sync emails.');
      setIsSyncingEmails(false);
      return;
    }

    try {
      const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=label:Receipts is:unread`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.messages || data.messages.length === 0) {
        alert('No new unread receipts found in Gmail.');
        setIsSyncingEmails(false);
        return;
      }

      let processedCount = 0;
      const functions = getFunctions(app, 'europe-west2');
      const processReceipt = httpsCallable(functions, 'processReceiptImage');

      for (const msg of data.messages) {
        const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const msgData = await msgRes.json();
        
        let attachmentId = null;
        let filename = '';
        let mimeType = '';
        
        let parts = msgData.payload?.parts || [];
        if (msgData.payload && !msgData.payload.parts) parts = [msgData.payload];
        
        // Recursive helper to find attachments
        const findAttachment = (pts: any[]) => {
          for (const p of pts) {
            if (p.filename && p.body?.attachmentId) {
              attachmentId = p.body.attachmentId;
              filename = p.filename;
              mimeType = p.mimeType;
              return true;
            }
            if (p.parts) {
              if (findAttachment(p.parts)) return true;
            }
          }
          return false;
        };
        findAttachment(parts);

        if (attachmentId) {
          const attRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}/attachments/${attachmentId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const attData = await attRes.json();
          const base64Data = attData.data.replace(/-/g, '+').replace(/_/g, '/');
          
          const result = await processReceipt({ base64Image: base64Data, mimeType });
          const extracted = result.data as any;
          
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: mimeType });
          const file = new File([blob], filename, { type: mimeType });
          
          let driveLink = '';
          const link = await uploadImageToDrive(file, token);
          if (link) driveLink = link;

          let formattedDate = extracted.date;
          if (!formattedDate) {
             formattedDate = new Date().toLocaleDateString('en-GB');
          } else if (formattedDate.includes('-') && formattedDate.length >= 10) {
             const dparts = formattedDate.split('T')[0].split('-');
             if (dparts.length === 3 && dparts[0].length === 4) {
               formattedDate = `${dparts[2]}/${dparts[1]}/${dparts[0]}`;
             }
          }

          let currentExpenses = [...expenses];
          let maxExpNum = 0;
          currentExpenses.forEach(e => {
            if (e.reference && e.reference.startsWith('EXP-')) {
              const num = parseInt(e.reference.replace('EXP-', ''), 10);
              if (!isNaN(num) && num > maxExpNum) maxExpNum = num;
            }
          });
          const ref = `EXP-${String(maxExpNum + 1).padStart(3, '0')}`;

          const row = [
            formattedDate, ref, extracted.type || 'Expense', extracted.category || 'Sundries',
            extracted.supplier || '', extracted.vatNumber || '', extracted.description || '',
            extracted.grossAmount || '', extracted.vatAmount || '', extracted.netAmount || '',
            'Director\'s Loan', '', driveLink, extracted.distance || ''
          ];

          await fetch(`https://sheets.googleapis.com/v4/spreadsheets/1AQZ854Zx8KCRG9EpiK0WnEuucI2qW7I-cQb1-k0fjP0/values/Transactions!A:N:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [row] })
          });

          await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}/modify`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ removeLabelIds: ['UNREAD'] })
          });
          
          // update local max reference hack for batch imports
          expenses.push({ reference: ref }); 
          processedCount++;
        }
      }

      if (processedCount > 0) {
        alert(`Successfully synced ${processedCount} receipts from email!`);
        window.location.reload(); 
      } else {
        alert("Found emails but no attachments could be extracted.");
      }

    } catch (err) {
      console.error(err);
      alert('Error syncing email receipts.');
    } finally {
      setIsSyncingEmails(false);
    }
  };

  const processReceiptFile = async (file: File) => {
    setIsScanningReceipt(true);
    setScannedExpense(null);
    setReceiptFile(file);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = (reader.result as string).split(',')[1];
        const functions = getFunctions(app, 'europe-west2');
        const processReceipt = httpsCallable(functions, 'processReceiptImage');
        
        try {
          const result = await processReceipt({ base64Image: base64String, mimeType: file.type });
          setScannedExpense({ ...(result.data as any), id: Date.now().toString(), date: (result.data as any).date || new Date().toISOString() });
        } catch (err) {
          console.error("Failed to process receipt:", err);
          alert("Failed to read receipt. Please try again.");
        } finally {
          setIsScanningReceipt(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setIsScanningReceipt(false);
    }
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    await processReceiptFile(file);
  };

  const uploadImageToDrive = async (file: File, token: string): Promise<string | null> => {
    try {
      let financesFolderId = null;
      const financesRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='Finances' and mimeType='application/vnd.google-apps.folder' and trashed=false`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const financesData = await financesRes.json();
      if (financesData.files && financesData.files.length > 0) {
        financesFolderId = financesData.files[0].id;
      }

      if (!financesFolderId) {
        console.warn("Finances folder not found in Google Drive.");
        return null;
      }

      let receiptsFolderId = null;
      const receiptsRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='Expense Receipts' and '${financesFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const receiptsData = await receiptsRes.json();
      if (receiptsData.files && receiptsData.files.length > 0) {
        receiptsFolderId = receiptsData.files[0].id;
      }

      if (!receiptsFolderId) {
        console.warn("Expense Receipts folder not found in Google Drive.");
        return null;
      }

      const metadata = {
        name: `${Date.now()}_receipt.jpg`,
        parents: [receiptsFolderId]
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', file);

      const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form
      });
      
      const uploadData = await uploadRes.json();
      return uploadData.webViewLink || null;
    } catch (err) {
      console.error("Drive upload failed", err);
      return null;
    }
  };

  const saveExpense = async () => {
    if (!user || !scannedExpense) return;
    
    try {
      const token = localStorage.getItem('googleAccessToken');
      if (!token) throw new Error("No Google Token");

      let driveLink = scannedExpense.receiptLink || '';
      if (receiptFile) {
        const link = await uploadImageToDrive(receiptFile, token);
        if (link) driveLink = link;
      }

      const SPREADSHEET_ID = '1AQZ854Zx8KCRG9EpiK0WnEuucI2qW7I-cQb1-k0fjP0';
      let formattedDate = scannedExpense.date;
      if (!formattedDate) {
        const d = new Date();
        formattedDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      } else if (formattedDate.includes('-') && formattedDate.length >= 10) {
        const parts = formattedDate.split('T')[0].split('-');
        if (parts.length === 3 && parts[0].length === 4) {
          formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }
      const date = formattedDate;

      let reference = scannedExpense.reference;
      if (!reference) {
        const prefix = (scannedExpense.type === 'Income') ? 'INC-' : 'EXP-';
        let maxNum = 0;
        expenses.forEach(exp => {
          if (exp.reference && exp.reference.startsWith(prefix)) {
            const numStr = exp.reference.replace(prefix, '');
            const num = parseInt(numStr, 10);
            if (!isNaN(num) && num > maxNum) {
              maxNum = num;
            }
          }
        });
        reference = `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
      }

      const type = scannedExpense.type || 'Expense';
      const category = scannedExpense.category || 'Sundries';
      const supplier = scannedExpense.supplier || '';
      const vatNumber = scannedExpense.vatNumber || '';
      const description = scannedExpense.description || 'Receipt upload';
      const grossAmount = scannedExpense.grossAmount || '';
      const vatAmount = scannedExpense.vatAmount || '0.00';
      const netAmount = scannedExpense.netAmount || '';
      let paymentMethod = scannedExpense.paymentMethod || 'Bank Transfer';
      if (paymentMethod === 'Director Loan') paymentMethod = "Director's Loan";

      const rowData = [
        date,
        reference,
        type,
        category,
        supplier,
        vatNumber,
        description,
        grossAmount,
        vatAmount,
        netAmount,
        paymentMethod,
        driveLink ? 'Y' : 'N',
        driveLink,
        scannedExpense.distance || ''
      ];

      if (scannedExpense.rowIndex) {
        // Edit existing row
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Transactions!A${scannedExpense.rowIndex}:N${scannedExpense.rowIndex}?valueInputOption=USER_ENTERED`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ values: [rowData] })
        });
        if (!res.ok) throw new Error("Failed to update Google Sheets");
        setExpenses(prev => prev.map(exp => exp.rowIndex === scannedExpense.rowIndex ? {
          rowIndex: scannedExpense.rowIndex, date, reference, type, category, supplier, vatNumber, description, grossAmount, vatAmount, netAmount, paymentMethod, receiptLink: driveLink
        } : exp));
      } else {
        // Append new row
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Transactions!A:N:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ values: [rowData] })
        });

        if (!res.ok) throw new Error("Failed to save to Google Sheets");
        
        // We do a naive refetch to get the accurate rowIndex, or just guess the next index
        const updatedRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Transactions!A:N`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const updatedData = await updatedRes.json();
        const newRowIndex = updatedData.values ? updatedData.values.length : expenses.length + 2;

        setExpenses(prev => [...prev, {
          rowIndex: newRowIndex, date, reference, type, category, supplier, vatNumber, description, grossAmount, vatAmount, netAmount, paymentMethod, receiptLink: driveLink
        }]);
      }
      
      setScannedExpense(null);
      setReceiptFile(null);
    } catch (err) {
      console.error("Failed to save expense:", err);
      alert("Could not save expense.");
    }
  };

  const deleteExpense = async (rowIndex: number) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    const token = localStorage.getItem('googleAccessToken');
    if (!token) return;
    
    try {
      const SPREADSHEET_ID = '1AQZ854Zx8KCRG9EpiK0WnEuucI2qW7I-cQb1-k0fjP0';
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Transactions!A${rowIndex}:N${rowIndex}:clear`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to clear row");
      setExpenses(prev => prev.filter(exp => exp.rowIndex !== rowIndex));
    } catch (err) {
      console.error("Failed to delete expense:", err);
      alert("Could not delete expense.");
    }
  };

  return (
    <>
      <MeetingRecorder />
      <header className="header glass-panel" style={{ flexDirection: 'row', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="icon-btn show-on-mobile" onClick={() => setDrawerOpen(true)} style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
            <Menu size={24} color="#f8fafc" />
          </button>
          <div className="logo">
            <img src="/alewood-logo.png" alt="Alewood Logo" className="logo-img" />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div className="hide-on-mobile" style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>CEO Portal</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
                System Online <span className="status-indicator"></span>
              </div>
            </div>
            <button className="icon-btn" onClick={subscribeToPush} title="Enable Notifications" style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '0.5rem', borderRadius: '50%' }}>
              <Bell size={20} color="#38bdf8" />
            </button>
            {needsTokenRefresh ? (
              <button className="icon-btn" onClick={handleTokenRefresh} title="Refresh Session (Required)" style={{ background: 'rgba(245, 158, 11, 0.2)', border: '1px solid #f59e0b', padding: '0.5rem', borderRadius: '50%', animation: 'pulse-danger 2s infinite' }}>
                <RefreshCw size={20} color="#f59e0b" />
              </button>
            ) : (
              <button className="icon-btn" onClick={handleTokenRefresh} title="Refresh Session" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '0.5rem', borderRadius: '50%' }}>
                <RefreshCw size={20} color="#cbd5e1" />
              </button>
            )}
            <div style={{ position: 'relative' }}>
              <img src="/ceo-avatar.png" alt="CEO Avatar" className="avatar" />
              <button onClick={() => signOut(auth)} className="icon-btn" style={{ position: 'absolute', bottom: -5, right: -5, background: 'var(--danger)', padding: '0.2rem', borderRadius: '50%' }}>
                <LogOut size={14} color="#fff" />
              </button>
            </div>
          </div>
        </div>
        <div className="tabs hide-on-mobile" style={{ marginTop: 0 }}>
          {['Operations', 'Sales', 'Product Build', 'Project Management', 'HR', 'Finance', 'Legal', 'Industry', 'Marketing'].map(tab => (
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

      {/* Mobile Drawer */}
      <div className={`mobile-drawer-overlay ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)}></div>
      <div className={`mobile-drawer ${drawerOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 1rem', marginBottom: '1rem' }}>
          <div style={{ fontWeight: 600, fontSize: '1.2rem', color: '#38bdf8' }}>Menu</div>
          <button className="icon-btn" onClick={() => setDrawerOpen(false)}>
            <X size={24} color="#f8fafc" />
          </button>
        </div>
        <div style={{ overflowY: 'auto', flexGrow: 1, padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {['Operations', 'Sales', 'Product Build', 'Project Management', 'HR', 'Finance', 'Legal', 'Industry', 'Marketing'].map(tab => (
            <button 
              key={tab} 
              className={`tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => { setActiveTab(tab); setDrawerOpen(false); }}
              style={{ padding: '1rem', width: '100%', justifyContent: 'flex-start' }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <main className="dashboard">
        {activeTab === 'Product Build' && (
          <>
          <div className="grid-auto" style={{ gridColumn: '1 / -1' }}>
        <div className="card glass-panel">
          <div className="card-header">
            <Activity color="#38bdf8" size={24} />
            Antigravity Orchestrator
          </div>
          <div className="card-content">
            {(() => {
              const filteredAgents = activeAgents ? activeAgents.filter((a: any) => !(a.workspace || '').includes('Alewood-PA')) : null;
              return (
                <>
                  <span className="metric">{filteredAgents ? filteredAgents.length : '...'} Agents Active</span>
                  <p style={{ marginTop: '0.5rem' }}>Moltbot is currently managing background infrastructure operations autonomously.</p>
                  <div style={{ marginTop: '1.5rem' }}>
                    {filteredAgents === null && !orchestratorError && (
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
                    {filteredAgents && filteredAgents.length === 0 && (
                      <div style={{ padding: '0.5rem 0', color: 'var(--text-secondary)' }}>No agents currently active in other workspaces.</div>
                    )}
                    {filteredAgents && filteredAgents.length > 0 && (() => {
                      const grouped: Record<string, any[]> = {};
                      filteredAgents.forEach((a: any) => {
                  const ws = a.workspace || 'Unknown Workspace';
                  if (!grouped[ws]) grouped[ws] = [];
                  grouped[ws].push(a);
                });
                return Object.keys(grouped).map(ws => (
                  <div key={ws} style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.75rem', fontWeight: 600, letterSpacing: '0.05em' }}>{ws}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {grouped[ws].map((agent: any) => {
                        const originalIdx = (activeAgents || []).findIndex((a: any) => a.id === agent.id);
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
                                  const newAgents = [...(activeAgents || [])];
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
            </>
          );
        })()}
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
              <span className="metric">{pipelineTasks === null ? 'Loading...' : `${pipelineTasks.filter((t: any) => categoryMatches(t.category, 'Project Management') && t.status !== 'Done').length} Pending Tasks`}</span>
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
                id="dropNotes"
                name="dropNotes"
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
            <div className="grid-auto" style={{ gridColumn: '1 / -1' }}>
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
                        <span style={{ fontSize: '0.75rem', marginTop: '0.1rem', color: 'var(--text-secondary)' }}>Received: {email.receivedAt}</span>
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
              <p style={{ marginTop: '0.5rem' }}>Live financial metrics fetched from your Google Sheets.</p>
              <div style={{ marginTop: '1.5rem' }}>
                <FinancialDashboard />
              </div>
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', color: '#10b981', margin: 0 }}>Expenses & Receipts</h3>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button className="btn" style={{ background: 'transparent', border: '1px solid #10b981', color: '#10b981', margin: 0, padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setScannedExpense({ supplier: '', amount: '', vat: '', type: '', category: '', distance: '' })}>Manual Entry</button>
                    <button className="btn" style={{ background: 'transparent', border: '1px solid #3b82f6', color: '#3b82f6', margin: 0, padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={syncEmailReceipts} disabled={isSyncingEmails}>
                      {isSyncingEmails ? <RefreshCw size={14} className="spin" /> : <Mail size={14} />}
                      {isSyncingEmails ? 'Syncing...' : 'Sync Email'}
                    </button>
                    <label className="btn" style={{ background: '#10b981', margin: 0, padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      {isScanningReceipt ? '...' : 'Upload'}
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleReceiptUpload} disabled={isScanningReceipt} />
                    </label>
                    <button className="btn" style={{ background: '#10b981', margin: 0, padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={() => setShowCameraModal(true)} disabled={isScanningReceipt}>
                      {isScanningReceipt ? 'Scanning...' : 'Camera'}
                    </button>
                  </div>
                </div>
                
                {scannedExpense && (
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', padding: '1.5rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#10b981', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CheckCircle size={20} /> AI Extraction Complete
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                      We've scanned your receipt and extracted the following details. Please review them, make any necessary corrections, and click Save.
                    </div>
                    <div className="grid-2" style={{ marginBottom: '1rem' }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Date</label>
                        <input type="date" className="chat-input" style={{ padding: '0.4rem', width: '100%', colorScheme: 'dark' }} 
                          value={scannedExpense.date && scannedExpense.date.includes('/') ? scannedExpense.date.split('/').reverse().join('-') : (scannedExpense.date || '')} 
                          onChange={e => setScannedExpense({...scannedExpense, date: e.target.value})} 
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Supplier</label>
                        <input className="chat-input" style={{ padding: '0.4rem', width: '100%' }} value={scannedExpense.supplier || ''} onChange={e => setScannedExpense({...scannedExpense, supplier: e.target.value})} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Supplier VAT Number</label>
                        <input className="chat-input" style={{ padding: '0.4rem', width: '100%' }} value={scannedExpense.vatNumber || ''} onChange={e => setScannedExpense({...scannedExpense, vatNumber: e.target.value})} />
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Description</label>
                        <input className="chat-input" style={{ padding: '0.4rem', width: '100%' }} value={scannedExpense.description || ''} onChange={e => setScannedExpense({...scannedExpense, description: e.target.value})} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Gross Amount (£)</label>
                        <input className="chat-input" style={{ padding: '0.4rem', width: '100%' }} value={scannedExpense.grossAmount || ''} onChange={e => setScannedExpense({...scannedExpense, grossAmount: e.target.value})} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>VAT (£)</label>
                        <input className="chat-input" style={{ padding: '0.4rem', width: '100%' }} value={scannedExpense.vatAmount || ''} onChange={e => setScannedExpense({...scannedExpense, vatAmount: e.target.value})} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Net Amount (£)</label>
                        <input className="chat-input" style={{ padding: '0.4rem', width: '100%' }} value={scannedExpense.netAmount || ''} onChange={e => setScannedExpense({...scannedExpense, netAmount: e.target.value})} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Payment Method</label>
                        <select className="chat-input" style={{ padding: '0.4rem', width: '100%', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }} value={scannedExpense.paymentMethod || 'Bank Transfer'} onChange={e => setScannedExpense({...scannedExpense, paymentMethod: e.target.value})}>
                          <option value="Bank Transfer" style={{color: '#000'}}>Bank Transfer</option>
                          <option value="Credit Card" style={{color: '#000'}}>Credit Card</option>
                          <option value="Debit Card" style={{color: '#000'}}>Debit Card</option>
                          <option value="Direct Debit" style={{color: '#000'}}>Direct Debit</option>
                          <option value="Cash" style={{color: '#000'}}>Cash</option>
                          <option value="Director's Loan" style={{color: '#000'}}>Director's Loan</option>
                          <option value="PayPal" style={{color: '#000'}}>PayPal</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Type</label>
                        <select className="chat-input" style={{ padding: '0.4rem', width: '100%', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }} value={scannedExpense.type || 'Expense'} onChange={e => setScannedExpense({...scannedExpense, type: e.target.value})}>
                          <option value="Expense" style={{color: '#000'}}>Expense</option>
                          <option value="Income" style={{color: '#000'}}>Income</option>
                          <option value="Asset" style={{color: '#000'}}>Asset</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Category</label>
                        <select className="chat-input" style={{ padding: '0.4rem', width: '100%', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }} value={scannedExpense.category || 'Sundries'} onChange={e => setScannedExpense({...scannedExpense, category: e.target.value})}>
                          {["Grant", "Software Subscriptions", "Travel", "Director Investment", "IT Equipment", "Subsistence", "Client Entertaining", "Marketing", "Sales", "Office Supplies", "Professional Services", "Web Hosting & Domains", "Cloud Infrastructure", "Bank Fees & Charges", "Insurance", "Statutory Fees", "Rent / Co-working", "Use of Home as Office", "Sundries", "Subcontractors/Freelancers", "Salaries", "Mileage"].map(cat => (
                            <option key={cat} value={cat} style={{color: '#000'}}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      {scannedExpense.category === 'Mileage' && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Distance (Miles)</label>
                          <input type="number" className="chat-input" style={{ padding: '0.4rem', width: '100%' }} value={scannedExpense.distance || ''} onChange={e => {
                             const dist = parseFloat(e.target.value) || 0;
                             setScannedExpense({...scannedExpense, distance: dist, grossAmount: (dist * 0.45).toFixed(2), netAmount: (dist * 0.45).toFixed(2), vatAmount: '0.00', supplier: scannedExpense.supplier || 'Mileage claim', type: 'Expense' });
                          }} />
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn" style={{ background: '#10b981' }} onClick={saveExpense}>Save Transaction</button>
                      <button className="btn" style={{ background: 'transparent', border: '1px solid var(--text-secondary)' }} onClick={() => { setScannedExpense(null); setReceiptFile(null); }}>Cancel</button>
                    </div>
                  </div>
                )}
                
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <input type="text" className="input-field" placeholder="Search expenses..." value={expenseSearch} onChange={e => setExpenseSearch(e.target.value)} style={{ flex: 1, minWidth: '200px' }} />
                  <select className="input-field" value={expenseFilterType} onChange={e => setExpenseFilterType(e.target.value)} style={{ width: 'auto' }}>
                    <option value="All">All Types</option>
                    <option value="Expense">Expense</option>
                    <option value="Income">Income</option>
                  </select>
                  <select className="input-field" value={expenseSort} onChange={e => setExpenseSort(e.target.value)} style={{ width: 'auto' }}>
                    <option value="Newest">Newest First</option>
                    <option value="Oldest">Oldest First</option>
                    <option value="Highest">Highest Amount</option>
                    <option value="Lowest">Lowest Amount</option>
                  </select>
                </div>
                
                {expenses.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {expenses.filter((exp: any) => {
                      if (expenseFilterType !== 'All' && exp.type !== expenseFilterType) return false;
                      if (expenseSearch) {
                        const q = expenseSearch.toLowerCase();
                        return (exp.supplier || '').toLowerCase().includes(q) || 
                               (exp.description || '').toLowerCase().includes(q) ||
                               (exp.category || '').toLowerCase().includes(q) ||
                               (exp.date || '').includes(q);
                      }
                      return true;
                    }).sort((a: any, b: any) => {
                      if (expenseSort === 'Newest') return (b.rowIndex || 0) - (a.rowIndex || 0);
                      if (expenseSort === 'Oldest') return (a.rowIndex || 0) - (b.rowIndex || 0);
                      const aAmt = parseFloat(String(a.grossAmount).replace(/£|,/g, '')) || 0;
                      const bAmt = parseFloat(String(b.grossAmount).replace(/£|,/g, '')) || 0;
                      if (expenseSort === 'Highest') return bAmt - aAmt;
                      if (expenseSort === 'Lowest') return aAmt - bAmt;
                      return 0;
                    }).slice(0, 50).map((exp: any, idx: number) => (
                      <div key={idx} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 500, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {exp.supplier || exp.description}
                            {exp.receiptLink && <a href={exp.receiptLink} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', fontSize: '0.75rem' }}>(View Receipt)</a>}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{exp.date ? `${exp.date} • ` : ''}{exp.category} • {exp.type}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 600, color: exp.type === 'Income' ? '#10b981' : '#f8fafc' }}>£{String(exp.grossAmount).replace('£', '').trim()}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>VAT: £{String(exp.vatAmount).replace('£', '').trim()}</div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.2rem' }}>
                            <button className="icon-btn" style={{ padding: '0.3rem', color: '#38bdf8' }} onClick={() => setScannedExpense(exp)} title="Edit">
                              <CheckSquare size={16} />
                            </button>
                            <button className="icon-btn" style={{ padding: '0.3rem', color: 'var(--danger)' }} onClick={() => deleteExpense(exp.rowIndex)} title="Delete">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '1rem', color: 'var(--text-secondary)', textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                    No expenses recorded yet. Scan a receipt to get started.
                  </div>
                )}
              </div>

              <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1rem', color: '#10b981', margin: 0 }}>Finance Tasks</h3>
                  <button className="btn" style={{ background: '#10b981', padding: '0.4rem 0.8rem', fontSize: '0.8rem', margin: 0 }} onClick={() => setSelectedTask({ category: 'Finance' })}>New Task</button>
                </div>
                {renderTasksForCategory('Finance')}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Legal' && (
          <div className="card glass-panel" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header">
              <Scale color="#a855f7" size={24} />
              Legal & Compliance
            </div>
            <div className="card-content">
              <span className="metric">Risk & Governance</span>
              <p style={{ marginTop: '0.5rem' }}>Manage security, compliance requirements, and legal documentation.</p>
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#a855f7' }}>Legal Tasks</h3>
                {renderTasksForCategory('Legal')}
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
                ) : industryUpdates.filter(u => {
                  let cleanHeadline = '';
                  let baseUrl = '';
                  try {
                    cleanHeadline = String(u.headline || '').replace(/<[^>]+>/g, '').replace(/&[#a-z0-9]+;/gi, '').replace(/[^a-z0-9]/gi, '').trim().toLowerCase();
                    baseUrl = String(u.url || '').split('?')[0].trim().toLowerCase();
                  } catch (err) {}
                  
                  const checkId = u.id ? String(u.id) : null;
                  const checkUrl = u.url ? String(u.url) : null;
                  const checkHeadline = u.headline ? String(u.headline) : null;

                  const matchesUrl = checkUrl && archivedUpdates.includes(checkUrl);
                  const matchesId = checkId && archivedUpdates.includes(checkId);
                  const matchesHeadline = checkHeadline && archivedUpdates.includes(checkHeadline);
                  const matchesCleanHeadline = cleanHeadline && archivedUpdates.includes(cleanHeadline);
                  const matchesBaseUrl = baseUrl && archivedUpdates.includes(baseUrl);
                  
                  const isArchived = matchesUrl || matchesId || matchesHeadline || matchesCleanHeadline || matchesBaseUrl;
                  
                  if (isArchived) {
                    console.log('[ARCHIVE DEBUG] HIDDEN:', u.headline, { matchesUrl, matchesId, matchesHeadline, matchesCleanHeadline, matchesBaseUrl });
                  }
                  
                  return !isArchived;
                }).length === 0 ? (
                  <div style={{ padding: '1rem 0', color: 'var(--text-secondary)' }}>No recent news found for your tracked entities. Please configure tracking.</div>
                ) : (
                  industryUpdates.filter(u => {
                    let cleanHeadline = '';
                    let baseUrl = '';
                    try {
                      cleanHeadline = String(u.headline || '').replace(/<[^>]+>/g, '').replace(/&[#a-z0-9]+;/gi, '').replace(/[^a-z0-9]/gi, '').trim().toLowerCase();
                      baseUrl = String(u.url || '').split('?')[0].trim().toLowerCase();
                    } catch (err) {}
                    
                    const checkId = u.id ? String(u.id) : null;
                    const checkUrl = u.url ? String(u.url) : null;
                    const checkHeadline = u.headline ? String(u.headline) : null;

                    const matchesUrl = checkUrl && archivedUpdates.includes(checkUrl);
                    const matchesId = checkId && archivedUpdates.includes(checkId);
                    const matchesHeadline = checkHeadline && archivedUpdates.includes(checkHeadline);
                    const matchesCleanHeadline = cleanHeadline && archivedUpdates.includes(cleanHeadline);
                    const matchesBaseUrl = baseUrl && archivedUpdates.includes(baseUrl);
                    
                    const isArchived = matchesUrl || matchesId || matchesHeadline || matchesCleanHeadline || matchesBaseUrl;
                    
                    return !isArchived;
                  }).map((update: any, idx: number) => (
                    <div key={`${update.id}-${idx}-${update.url ? update.url.substring(0,20) : ''}`} className="list-item" style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.05)', display: 'block', cursor: 'pointer', transition: 'background 0.2s', position: 'relative' }} onClick={() => window.open(update.url, '_blank')} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'} onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}>
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
                              const textHeadline = String(update.headline || '').replace(/<[^>]+>/g, '');
                              sendSilentCommand(`create task: Review industry update - ${textHeadline}`, { sourceUrl: update.url }); 
                              alert('Task created in Master Pipeline'); 
                            }}
                            title="Create Task"
                          >
                            <CheckSquare size={14} color="#38bdf8" />
                          </button>
                          <button 
                            className="icon-btn" 
                            style={{ padding: '0.25rem', background: 'rgba(255,255,255,0.05)' }} 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              const cleanHeadline = String(update.headline || '').replace(/<[^>]+>/g, '');
                              localStorage.setItem('pendingMarketingShare', `${cleanHeadline}\n\n${update.url}`);
                              setActiveTab('Marketing'); 
                            }}
                            title="Create Post"
                          >
                            <Share2 size={14} color="#f472b6" />
                          </button>
                          <button 
                            className="icon-btn" 
                            style={{ padding: '0.25rem', background: 'rgba(255,255,255,0.05)' }} 
                            onClick={async (e) => { 
                              e.stopPropagation(); 
                              try {
                                const token = localStorage.getItem('googleAccessToken');
                                if (!token) {
                                  alert('Please login with Google first.');
                                  return;
                                }
                                
                                // Clean up html from headline and snippet
                                const cleanHeadline = String(update.headline || '').replace(/<[^>]+>/g, '');
                                const cleanSnippet = String(update.snippet || '').replace(/<[^>]+>/g, '');
                                
                                // Search for Master Doc
                                const searchRes = await fetch("https://www.googleapis.com/drive/v3/files?q=name='NotebookLM Master Transcripts' and trashed=false", {
                                  headers: { Authorization: `Bearer ${token}` }
                                });
                                const searchData = await searchRes.json();
                                let masterDocId = searchData.files && searchData.files.length > 0 ? searchData.files[0].id : null;

                                if (!masterDocId) {
                                  const docCreateRes = await fetch('https://www.googleapis.com/drive/v3/files', {
                                    method: 'POST',
                                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ name: 'NotebookLM Master Transcripts', mimeType: 'application/vnd.google-apps.document' })
                                  });
                                  const docData = await docCreateRes.json();
                                  masterDocId = docData.id;
                                  if (!masterDocId) {
                                    throw new Error("Could not create Master Transcripts document.");
                                  }
                                }
                                
                                const docContent = `\n\n=================================================\nSaved News Article: ${new Date().toLocaleString()}\nTitle: ${cleanHeadline}\nURL: ${update.url}\n\nSummary:\n${cleanSnippet}\n=================================================\n\n`;
                                await fetch(`https://docs.googleapis.com/v1/documents/${masterDocId}:batchUpdate`, {
                                  method: 'POST',
                                  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ requests: [{ insertText: { location: { index: 1 }, text: docContent } }] })
                                });

                                alert('Article appended to your NotebookLM Master Transcripts Google Doc! It will appear in NotebookLM once synced.');
                              } catch (err) {
                                console.error('NotebookLM error details:', err);
                                alert('Failed to save to NotebookLM Doc: ' + ((err as Error).message || String(err)));
                              }
                            }}
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
                            onClick={(e) => handleArchiveUpdate(e, update)}
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
        {activeTab === 'Sales' && <SalesTab />}
      </main>

      <button className="chat-fab" onClick={() => setChatOpen(true)}>
        <MessageSquare size={24} color="#fff" />
      </button>

      <div className={`chat-panel glass-panel ${chatOpen ? 'open' : ''}`}>
        <div className="chat-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Activity color="#38bdf8" />
            <span style={{ fontWeight: 600 }}>Alewood AI Assistant</span>
          </div>
          <button className="icon-btn" onClick={() => setChatOpen(false)}>
            <X size={20} color="#fff" />
          </button>
        </div>
        
        {!geminiApiKey ? (
          <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', flexGrow: 1 }}>
            <h3 style={{ margin: 0 }}>Setup Gemini</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Please enter your Gemini API key to enable the AI assistant. It will be stored securely in your browser's local storage.</p>
            <input 
              type="password" 
              className="chat-input" 
              placeholder="AIzaSy..." 
              value={geminiInputKey} 
              onChange={e => setGeminiInputKey(e.target.value)} 
            />
            <button className="btn" onClick={() => {
              localStorage.setItem('geminiApiKey', geminiInputKey);
              setGeminiApiKey(geminiInputKey);
            }}>Save Key</button>
          </div>
        ) : (
          <>
            <div className="chat-messages">
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`message ${msg.role}`}>
                  <div className="message-bubble">{msg.text}</div>
                </div>
              ))}
              {isChatLoading && (
                <div className="message bot">
                  <div className="message-bubble" style={{ opacity: 0.7 }}>Thinking...</div>
                </div>
              )}
            </div>

            <form className="chat-input-area" onSubmit={handleSendMessage}>
              <input 
                id="chatMessage"
                name="chatMessage"
                type="text" 
                placeholder="Ask me to schedule a meeting..." 
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
        </>
        )}
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
        initialConfig={industryConfig}
        onClose={() => setShowIndustrySettings(false)} 
        onSave={async (config) => {
          setIndustryConfig(config);
          localStorage.setItem('industryConfig', JSON.stringify(config));
          if (user) {
            try {
              const savePromise = setDoc(doc(db, 'users', user.uid), { industryConfig: config }, { merge: true });
              const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000));
              await Promise.race([savePromise, timeoutPromise]);
              alert("Settings successfully synced to cloud.");
            } catch (err) {
              console.error("Failed to save config to Firebase", err);
              alert("WARNING: Failed to sync settings to the cloud (you may be offline). Settings are saved locally.");
            }
          }
          setShowIndustrySettings(false);
        }} 
      />}
      
      {showCameraModal && (
        <ReceiptCameraModal 
          onClose={() => setShowCameraModal(false)}
          onCapture={(file) => {
            setShowCameraModal(false);
            processReceiptFile(file);
          }}
        />
      )}

      

    </>
  )
}

export default App
