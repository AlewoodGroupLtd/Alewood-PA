import React, { useState, useRef } from 'react';
import { Mic, Square, Loader2, X } from 'lucide-react';
import { saveAudioChunk, getAudioChunks, clearAudioChunks } from './audioDB';
import { getFunctions, httpsCallable } from 'firebase/functions';

export const MeetingRecorder: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showLinkModal, setShowLinkModal] = useState(false);
  
  const [pendingEvents, setPendingEvents] = useState<any[]>([]);
  const [showEventsModal, setShowEventsModal] = useState(false);
  
  // CRM Linkage State
  const [companiesList, setCompaniesList] = useState<string[]>([]);
  const [peopleList, setPeopleList] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedPerson, setSelectedPerson] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const sessionIdRef = useRef<string>('');
  const timerRef = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      } catch (err: any) {
        console.error(`${err.name}, ${err.message}`);
      }
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current !== null) {
      wakeLockRef.current.release().then(() => { wakeLockRef.current = null; });
    }
  };


  const fetchCRMLists = async () => {
    const token = localStorage.getItem('googleAccessToken');
    if (!token) return;
    const SALES_SPREADSHEET_ID = '1_DvYuIUkKy903wKlRHeR953RsGBLynDu5bhBZ72yCO0';
    try {
      const [compRes, peopleRes] = await Promise.all([
        fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SALES_SPREADSHEET_ID}/values/Companies!A:Z`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SALES_SPREADSHEET_ID}/values/People!A:Z`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const compData = await compRes.json();
      const peopleData = await peopleRes.json();
      
      if (compData.values && compData.values.length > 2) {
        const hIdx = compData.values[2].findIndex((h:string) => h.includes('Company') || h.includes('Name'));
        if (hIdx !== -1) {
          const comps = compData.values.slice(3).map((r:any) => r[hIdx]).filter(Boolean);
          setCompaniesList([...new Set(comps)] as string[]);
        }
      }
      
      if (peopleData.values && peopleData.values.length > 2) {
        const hIdx = peopleData.values[2].findIndex((h:string) => h.includes('Name') || h.includes('Person'));
        if (hIdx !== -1) {
          const peeps = peopleData.values.slice(3).map((r:any) => r[hIdx]).filter(Boolean);
          setPeopleList([...new Set(peeps)] as string[]);
        }
      }
    } catch(e) { console.error('Failed to fetch CRM lists', e); }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      sessionIdRef.current = `meeting_${Date.now()}`;
      let chunkIndex = 0;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          await saveAudioChunk(sessionIdRef.current, event.data, chunkIndex++);
        }
      };

      mediaRecorder.start(10000);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => setRecordingTime(t => t + 1), 1000);

      await requestWakeLock();
    } catch (err) {
      console.error("Error starting recording:", err);
      alert("Microphone access is required.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
      
      if (timerRef.current) clearInterval(timerRef.current);
      releaseWakeLock();
      
      // Instead of processing immediately, show linkage modal
      setSelectedCompany('');
      setSelectedPerson('');
      setShowLinkModal(true);
      fetchCRMLists();
    }
  };

  const getOrCreateFolder = async (token: string, folderName: string) => {
    let q = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.files && data.files.length > 0) return data.files[0].id;

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: folderName, mimeType: 'application/vnd.google-apps.folder' })
    });
    const createData = await createRes.json();
    return createData.id;
  };

  const processRecording = async () => {
    setShowLinkModal(false);
    setIsProcessing(true);
    const token = localStorage.getItem('googleAccessToken');
    if (!token) {
      alert("Please login with Google.");
      setIsProcessing(false);
      return;
    }

    try {
      const sessionId = sessionIdRef.current;
      const chunks = await getAudioChunks(sessionId);
      if (chunks.length === 0) throw new Error("No audio recorded.");
      
      const mimeType = chunks[0].type || 'audio/webm';
      const audioBlob = new Blob(chunks, { type: mimeType });

      const folderId = await getOrCreateFolder(token, 'Meet Recordings');
      
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify({ name: `Meeting_${new Date().toISOString()}.webm`, parents: [folderId] })], { type: 'application/json' }));
      form.append('file', audioBlob);

      const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form
      });
      const uploadData = await uploadRes.json();

      const functions = getFunctions(undefined, 'europe-west2');
      const processMeetingAudio = httpsCallable(functions, 'processMeetingAudio', { timeout: 540000 });
      
      const result = await processMeetingAudio({ 
        fileId: uploadData.id, 
        googleAccessToken: token,
        mimeType,
        contextCompany: selectedCompany,
        contextPerson: selectedPerson
      });

      const responseData: any = result.data;

      // Master Doc for NotebookLM
      const searchRes = await fetch("https://www.googleapis.com/drive/v3/files?q=name='NotebookLM Master Transcripts' and trashed=false", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const searchData = await searchRes.json();
      let masterDocId = searchData.files && searchData.files.length > 0 ? searchData.files[0].id : null;

      if (!masterDocId) {
        const docCreateRes = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'NotebookLM Master Transcripts', mimeType: 'application/vnd.google-apps.document', parents: [folderId] })
        });
        const docData = await docCreateRes.json();
        masterDocId = docData.id;
      }
      
      const docContent = `\n\n=================================================\nMeeting Date: ${new Date().toLocaleString()}\nContext: ${selectedPerson ? selectedPerson + ' at ' : ''}${selectedCompany}\n\nSummary:\n${responseData.summary}\n\nTranscript:\n${responseData.transcript}\n=================================================\n\n`;
      await fetch(`https://docs.googleapis.com/v1/documents/${masterDocId}:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{ insertText: { location: { index: 1 }, text: docContent } }] })
      });

      const SALES_SPREADSHEET_ID = '1_DvYuIUkKy903wKlRHeR953RsGBLynDu5bhBZ72yCO0';
      
      if (responseData.tasks && responseData.tasks.length > 0) {
        for (const t of responseData.tasks) {
          const rowData = [t.task || '', t.dueDate || '', t.priority || 'Medium', 'Not Started', `Meeting ${new Date().toLocaleDateString()}`];
          await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SALES_SPREADSHEET_ID}/values/Tasks!A:E:append?valueInputOption=USER_ENTERED`, {
            method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [rowData] })
          });
        }
      }

      let finalActivities = responseData.activities || [];
      if (finalActivities.length === 0 && (selectedCompany || selectedPerson)) {
        finalActivities.push({
          company: selectedCompany || '',
          person: selectedPerson || '',
          notes: responseData.summary || 'Meeting recorded and processed via AI.'
        });
      }

      if (finalActivities.length > 0) {
        for (const a of finalActivities) {
          const rowData = [
            a.person || selectedPerson || '', 
            a.company || selectedCompany || '', 
            'Meeting', 
            new Date().toISOString().split('T')[0], 
            a.notes || responseData.summary || ''
          ];
          await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SALES_SPREADSHEET_ID}/values/Activities!A:E:append?valueInputOption=USER_ENTERED`, {
            method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [rowData] })
          });
        }
      }

      if (responseData.opportunities && responseData.opportunities.length > 0) {
        for (const opp of responseData.opportunities) {
          const rowData = [
            new Date().toISOString().split('T')[0], // Date Added
            opp.company || selectedCompany || '',   // Company
            selectedPerson || '',                   // Contact
            opp.description || '',                  // Requirement
            opp.value || '0',                       // Expected Value
            'New',                                  // Stage
            'Open',                                 // Status
            '',                                     // Loss Reason
            'AI Meeting Notes',                     // Source
            '',                                     // Primary System
            '',                                     // Expected Close Date
            'Medium'                                // Priority
          ];
          await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SALES_SPREADSHEET_ID}/values/Opportunities!A:L:append?valueInputOption=USER_ENTERED`, {
            method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [rowData] })
          });
        }
      }

      if (selectedCompany && !companiesList.some(c => c.toLowerCase() === selectedCompany.toLowerCase())) {
        const rowData = [new Date().toISOString().split('T')[0], selectedCompany, 'Active', '', '', ''];
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SALES_SPREADSHEET_ID}/values/Companies!A:F:append?valueInputOption=USER_ENTERED`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [rowData] })
        });
      }

      if (selectedPerson && !peopleList.some(p => p.toLowerCase() === selectedPerson.toLowerCase())) {
        const parts = selectedPerson.split(' ');
        const first = parts[0] || '';
        const last = parts.slice(1).join(' ') || '';
        const rowData = [selectedCompany || '', first, last, '', '', '', '', 'Active'];
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SALES_SPREADSHEET_ID}/values/Contacts!A:H:append?valueInputOption=USER_ENTERED`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [rowData] })
        });
      }

      await clearAudioChunks(sessionId);
      
      if (responseData.events && responseData.events.length > 0) {
        setPendingEvents(responseData.events.map((e: any) => ({
          ...e,
          attendees: Array.isArray(e.attendees) ? e.attendees.join(', ') : (e.attendees || '')
        })));
        setShowEventsModal(true);
      } else {
        alert("Meeting processed successfully!");
      }

    } catch (err: any) {
      console.error(err);
      alert("Failed to process meeting. Error: " + err.message + ". Audio chunks saved locally.");
    } finally {
      setIsProcessing(false);
    }
  };

  const cancelRecording = async () => {
    setShowLinkModal(false);
    if (sessionIdRef.current) {
      await clearAudioChunks(sessionIdRef.current);
    }
  };

  const handleScheduleEvents = async () => {
    const token = localStorage.getItem('googleAccessToken');
    if (!token) return;
    
    setIsProcessing(true);
    try {
      for (const ev of pendingEvents) {
        if (!ev.startTime || !ev.endTime) continue;
        
        const attendeesArray = ev.attendees
          ? ev.attendees.split(',').map((a: string) => ({ email: a.trim() })).filter((a: any) => a.email.includes('@'))
          : [];

        await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            summary: ev.title || 'Meeting Scheduled via AI',
            description: ev.description || '',
            start: { dateTime: ev.startTime },
            end: { dateTime: ev.endTime },
            attendees: attendeesArray.length > 0 ? attendeesArray : undefined
          })
        });
      }
      alert("Meeting and events processed successfully!");
    } catch (err: any) {
      console.error(err);
      alert("Failed to schedule events. " + err.message);
    } finally {
      setIsProcessing(false);
      setShowEventsModal(false);
      setPendingEvents([]);
    }
  };

  return (
    <>
      <div style={{ position: 'fixed', bottom: '2rem', left: '2rem', zIndex: 40, display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {isProcessing && (
          <div className="glass-panel" style={{ padding: '0.5rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderRadius: '2rem', fontSize: '0.95rem' }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Processing...
          </div>
        )}
        {isRecording && (
          <div className="glass-panel" style={{ padding: '0.5rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderRadius: '2rem', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
            <div className="status-indicator" style={{ backgroundColor: 'var(--danger)', boxShadow: '0 0 10px var(--danger)' }} />
            <span style={{ color: 'var(--danger)', fontWeight: 600, fontFamily: 'monospace', fontSize: '0.95rem' }}>{formatTime(recordingTime)}</span>
          </div>
        )}
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          className={`mic-fab ${isRecording ? 'recording' : ''}`}
          style={{ opacity: isProcessing ? 0.5 : 1, cursor: isProcessing ? 'not-allowed' : 'pointer' }}
        >
          {isRecording ? <Square size={24} fill="currentColor" /> : <Mic size={24} />}
        </button>
      </div>

      {showLinkModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Link Meeting to CRM</h3>
              <button onClick={cancelRecording} className="icon-btn">
                <X size={20} />
              </button>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Company</label>
              <input
                type="text"
                list="companies-list"
                value={selectedCompany}
                onChange={e => setSelectedCompany(e.target.value)}
                placeholder="Search or type new..."
                style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', padding: '0.75rem', color: '#fff', outline: 'none' }}
              />
              <datalist id="companies-list">
                {companiesList.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Person</label>
              <input
                type="text"
                list="people-list"
                value={selectedPerson}
                onChange={e => setSelectedPerson(e.target.value)}
                placeholder="Search or type new..."
                style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', padding: '0.75rem', color: '#fff', outline: 'none' }}
              />
              <datalist id="people-list">
                {peopleList.map(p => <option key={p} value={p} />)}
              </datalist>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button
                onClick={cancelRecording}
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--danger)', cursor: 'pointer', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: 500 }}
              >
                Cancel
              </button>
              <div style={{ flexGrow: 1 }} />
              <button
                onClick={() => processRecording()}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.5rem 1rem', borderRadius: '0.5rem' }}
              >
                Skip Link
              </button>
              <button
                onClick={() => processRecording()}
                className="btn"
                style={{ margin: 0, padding: '0.5rem 1.25rem' }}
              >
                Save & Process
              </button>
            </div>
          </div>
        </div>
      )}

      {showEventsModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Review Calendar Events</h3>
              <button onClick={() => { setShowEventsModal(false); setPendingEvents([]); alert("Meeting processed successfully!"); }} className="icon-btn">
                <X size={20} />
              </button>
            </div>
            
            {pendingEvents.map((ev, idx) => (
              <div key={idx} style={{ marginBottom: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem' }}>
                <div style={{ marginBottom: '0.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Event Title</label>
                  <input type="text" value={ev.title || ''} onChange={e => {
                    const newEvs = [...pendingEvents];
                    newEvs[idx].title = e.target.value;
                    setPendingEvents(newEvs);
                  }} style={{ width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.5rem', borderRadius: '0.25rem' }} />
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Start (ISO)</label>
                    <input type="text" value={ev.startTime || ''} onChange={e => {
                      const newEvs = [...pendingEvents];
                      newEvs[idx].startTime = e.target.value;
                      setPendingEvents(newEvs);
                    }} style={{ width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.5rem', borderRadius: '0.25rem' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>End (ISO)</label>
                    <input type="text" value={ev.endTime || ''} onChange={e => {
                      const newEvs = [...pendingEvents];
                      newEvs[idx].endTime = e.target.value;
                      setPendingEvents(newEvs);
                    }} style={{ width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.5rem', borderRadius: '0.25rem' }} />
                  </div>
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Attendees (comma-separated emails)</label>
                  <input type="text" value={ev.attendees || ''} onChange={e => {
                    const newEvs = [...pendingEvents];
                    newEvs[idx].attendees = e.target.value;
                    setPendingEvents(newEvs);
                  }} placeholder="name@example.com" style={{ width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.5rem', borderRadius: '0.25rem' }} />
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button onClick={() => { setShowEventsModal(false); setPendingEvents([]); alert("Meeting processed successfully!"); }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--text-secondary)', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer' }}>
                Skip Events
              </button>
              <button onClick={handleScheduleEvents} className="btn" style={{ padding: '0.5rem 1.25rem', margin: 0, cursor: 'pointer' }}>
                Confirm & Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
