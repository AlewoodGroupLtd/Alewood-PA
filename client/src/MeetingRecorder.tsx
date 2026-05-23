import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, X } from 'lucide-react';
import { saveAudioChunk, getAudioChunks, clearAudioChunks } from './audioDB';
import { getFunctions, httpsCallable } from 'firebase/functions';

export const MeetingRecorder: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showLinkModal, setShowLinkModal] = useState(false);
  
  // CRM Linkage State
  const [companiesList, setCompaniesList] = useState<string[]>([]);
  const [peopleList, setPeopleList] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedPerson, setSelectedPerson] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const sessionIdRef = useRef<string>('');
  const timerRef = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

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

  const startSilentAudio = () => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    audioContextRef.current = new AudioContext();
    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();
    gainNode.gain.value = 0.001; 
    oscillator.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);
    oscillator.start();
  };

  const stopSilentAudio = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
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
      startSilentAudio();
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
      stopSilentAudio();
      
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

      const functions = getFunctions();
      const processMeetingAudio = httpsCallable(functions, 'processMeetingAudio');
      
      const result = await processMeetingAudio({ 
        fileId: uploadData.id, 
        googleAccessToken: token,
        mimeType,
        contextCompany: selectedCompany,
        contextPerson: selectedPerson
      });

      const responseData: any = result.data;

      // Doc
      const docCreateRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Transcript_${new Date().toISOString()}`, mimeType: 'application/vnd.google-apps.document', parents: [folderId] })
      });
      const docData = await docCreateRes.json();
      
      const docContent = `Meeting Context: ${selectedPerson ? selectedPerson + ' at ' : ''}${selectedCompany}\n\nSummary:\n${responseData.summary}\n\nTranscript:\n${responseData.transcript}`;
      await fetch(`https://docs.googleapis.com/v1/documents/${docData.id}:batchUpdate`, {
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

      if (responseData.activities && responseData.activities.length > 0) {
        for (const a of responseData.activities) {
          const rowData = [a.company || selectedCompany || '', a.person || selectedPerson || '', new Date().toLocaleDateString(), 'Meeting', a.notes || ''];
          await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SALES_SPREADSHEET_ID}/values/Activities!A:E:append?valueInputOption=USER_ENTERED`, {
            method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [rowData] })
          });
        }
      }

      await clearAudioChunks(sessionId);
      alert("Meeting processed successfully!");

    } catch (err) {
      console.error(err);
      alert("Failed to process meeting. Audio chunks saved locally.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-6 left-6 z-40 flex items-center gap-3">
        {isProcessing && (
          <div className="bg-white/80 backdrop-blur border border-white/40 shadow-xl rounded-full px-4 py-2 flex items-center gap-2 text-sm text-slate-700">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> Processing...
          </div>
        )}
        {isRecording && (
          <div className="bg-red-500/10 backdrop-blur border border-red-500/30 shadow-xl rounded-full px-4 py-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-600 font-medium font-mono text-sm">{formatTime(recordingTime)}</span>
          </div>
        )}
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all ${
            isRecording ? 'bg-red-50 border-2 border-red-500 text-red-500' : 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white'
          } ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
        >
          {isRecording ? <Square className="w-6 h-6" fill="currentColor" /> : <Mic className="w-6 h-6" />}
        </button>
      </div>

      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-white">Link Meeting to CRM</h3>
              <button onClick={() => setShowLinkModal(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">Company</label>
              <input
                type="text"
                list="companies-list"
                value={selectedCompany}
                onChange={e => setSelectedCompany(e.target.value)}
                placeholder="Search or type new..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <datalist id="companies-list">
                {companiesList.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">Person</label>
              <input
                type="text"
                list="people-list"
                value={selectedPerson}
                onChange={e => setSelectedPerson(e.target.value)}
                placeholder="Search or type new..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <datalist id="people-list">
                {peopleList.map(p => <option key={p} value={p} />)}
              </datalist>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => processRecording()}
                className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors"
              >
                Skip Link
              </button>
              <button
                onClick={() => processRecording()}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-lg shadow-blue-500/20"
              >
                Save & Process
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
