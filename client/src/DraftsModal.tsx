import { useState, useEffect } from 'react';
import { X, Check, Edit2, Trash2 } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

export default function DraftsModal({ emails, onClose }: { emails: any[], onClose: () => void }) {
  const [drafts, setDrafts] = useState<any[]>([]);

  useEffect(() => {
    if (!emails) return;
    
    // Set initial loading state
    const initialDrafts = emails.map(email => ({
      id: email.id,
      subject: email.subject,
      sender: email.from,
      snippet: email.snippet,
      botDraft: "Moltbot is generating a response... Please wait.",
      type: 'reply', // default
      status: 'pending',
      loading: true,
      isEditing: false
    }));
    setDrafts(initialDrafts);

    const functions = getFunctions(app, 'europe-west2');
    const generateDraft = httpsCallable(functions, 'generateDraft');

    // Fetch drafts asynchronously
    emails.forEach(async (email) => {
      try {
        const result = await generateDraft({ subject: email.subject, sender: email.from, snippet: email.snippet });
        const { draft, type } = result.data as any;
        setDrafts(prev => prev.map(d => d.id === email.id ? { ...d, botDraft: draft, type: type || 'reply', loading: false } : d));
      } catch (err: any) {
        console.error("Failed to generate draft:", err);
        setDrafts(prev => prev.map(d => d.id === email.id ? { ...d, botDraft: `Failed to generate response: ${err.message}`, loading: false } : d));
      }
    });

  }, [emails]);

  const handleAction = (id: string, action: 'approve' | 'discard') => {
    setDrafts(drafts.map(d => d.id === id ? { ...d, status: action, isEditing: false } : d));
  };

  const handleCreateTask = async (id: string, summary: string) => {
    try {
      const token = localStorage.getItem('googleAccessToken');
      if (!token) throw new Error("No token");
      const sourceUrl = `https://mail.google.com/mail/u/0/#inbox/${id}`;
      
      // Send directly to Google Sheets Master Pipeline to avoid mixed content / localhost issues on PWA
      const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets/1yskd_H80YpKH5pW1vwpVVyIi49Ce86m87VQP99VJ2mw/values/Pipeline!A:I:append?valueInputOption=USER_ENTERED', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ 
          values: [[summary, "CEO", "Medium", "Open", "TBD", sourceUrl, "Operations", new Date().toISOString(), ""]] 
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error?.message || 'Failed to append to Google Sheets');
      }

      // Archive the email
      await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          removeLabelIds: ['INBOX', 'UNREAD']
        })
      });

      setDrafts(drafts.map(d => d.id === id ? { ...d, status: 'approve', isEditing: false } : d));
    } catch (e: any) {
      console.error(e);
      alert(`Error creating task: ${e.message}`);
    }
  };

  const toggleEdit = (id: string) => {
    setDrafts(drafts.map(d => d.id === id ? { ...d, isEditing: !d.isEditing } : d));
  };

  const updateDraftText = (id: string, text: string) => {
    setDrafts(drafts.map(d => d.id === id ? { ...d, botDraft: text } : d));
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '1rem'
    }}>
      <div className="card glass-panel" style={{ width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Review Email Drafts</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} color="#fff" /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {drafts.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>No pending drafts.</p>
          ) : drafts.map(draft => (
            <div key={draft.id} style={{ 
              background: 'rgba(255,255,255,0.03)', 
              border: '1px solid rgba(255,255,255,0.05)', 
              borderRadius: '0.75rem',
              padding: '1.25rem',
              opacity: draft.status !== 'pending' ? 0.5 : 1
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <strong style={{ color: '#fff', fontSize: '1.1rem' }}>{draft.subject}</strong>
                {draft.status === 'approve' && <span style={{ color: 'var(--success)', fontSize: '0.85rem' }}>{draft.type === 'task' ? 'Task Created' : 'Sent'}</span>}
                {draft.status === 'discard' && <span style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>Discarded</span>}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                From: {draft.sender}
              </div>
              
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', borderLeft: '3px solid #38bdf8' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#38bdf8', marginBottom: '0.5rem', fontWeight: 600 }}>Original Email Context</div>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, color: '#e2e8f0', fontSize: '0.9rem' }}>{draft.snippet ? `"...${draft.snippet}..."` : 'No preview available.'}</div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', borderLeft: `3px solid ${draft.type === 'task' ? '#f59e0b' : '#a855f7'}` }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: draft.type === 'task' ? '#f59e0b' : '#a855f7', marginBottom: '0.5rem', fontWeight: 600 }}>
                  {draft.type === 'task' ? 'Recommended Action: Create Task' : 'Moltbot Draft'}
                </div>
                {draft.isEditing ? (
                  <textarea 
                    value={draft.botDraft}
                    onChange={(e) => updateDraftText(draft.id, e.target.value)}
                    style={{
                      width: '100%', minHeight: '120px', background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)', color: '#fff',
                      padding: '0.75rem', borderRadius: '0.5rem', outline: 'none',
                      resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5
                    }}
                  />
                ) : (
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, color: '#e2e8f0' }}>{draft.botDraft}</div>
                )}
              </div>

              {draft.status === 'pending' && (
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                  {draft.type === 'task' ? (
                    <button 
                      style={{ flex: 1, background: '#f59e0b', color: '#000', border: 'none', padding: '0.6rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 500 }}
                      onClick={() => handleCreateTask(draft.id, draft.botDraft)}
                    >
                      <Check size={16} /> Send to Pipeline
                    </button>
                  ) : (
                    <button 
                      style={{ flex: 1, background: 'var(--success)', color: '#fff', border: 'none', padding: '0.6rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 500 }}
                      onClick={() => handleAction(draft.id, 'approve')}
                    >
                      <Check size={16} /> Approve & Send
                    </button>
                  )}
                  <button 
                    onClick={() => toggleEdit(draft.id)}
                    style={{ background: draft.isEditing ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255,255,255,0.1)', color: draft.isEditing ? '#a855f7' : '#fff', border: draft.isEditing ? '1px solid rgba(168, 85, 247, 0.4)' : 'none', padding: '0.6rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <Edit2 size={16} /> {draft.isEditing ? 'Done Editing' : 'Edit'}
                  </button>
                  <button 
                    style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.6rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    onClick={() => handleAction(draft.id, 'discard')}
                  >
                    <Trash2 size={16} /> Discard
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
