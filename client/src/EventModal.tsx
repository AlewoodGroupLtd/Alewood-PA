import { useState } from 'react';
import { X, Save, ExternalLink, Calendar as CalendarIcon, Clock, Trash2 } from 'lucide-react';
import { auth } from './firebase';
import { signOut } from 'firebase/auth';

export default function EventModal({ event, onClose, onSave, onDelete }: { event: any, onClose: () => void, onSave: (updatedEvent: any, isNew?: boolean) => void, onDelete?: (eventId: string) => void }) {
  const [summary, setSummary] = useState(event?.summary || '');
  const [description, setDescription] = useState(event?.description || '');
  
  const isNew = !event?.id;
  
  // Parse initial dates safely
  const initialStart = event?.start?.dateTime ? new Date(event.start.dateTime) : (event?.start?.date ? new Date(event.start.date) : new Date());
  const initialEnd = event?.end?.dateTime ? new Date(event.end.dateTime) : (event?.end?.date ? new Date(event.end.date) : new Date(Date.now() + 3600000));
  
  // Format to local input strings
  const pad = (n: number) => n.toString().padStart(2, '0');
  const [startDate, setStartDate] = useState(`${initialStart.getFullYear()}-${pad(initialStart.getMonth()+1)}-${pad(initialStart.getDate())}`);
  const [startTime, setStartTime] = useState(`${pad(initialStart.getHours())}:${pad(initialStart.getMinutes())}`);
  const [endDate, setEndDate] = useState(`${initialEnd.getFullYear()}-${pad(initialEnd.getMonth()+1)}-${pad(initialEnd.getDate())}`);
  const [endTime, setEndTime] = useState(`${initialEnd.getHours().toString().padStart(2, '0')}:${initialEnd.getMinutes().toString().padStart(2, '0')}`);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('googleAccessToken');
      if (!token) throw new Error("No token");

      // Construct proper RFC3339 timestamps for local time zone
      const startObj = new Date(`${startDate}T${startTime}`);
      const endObj = new Date(`${endDate}T${endTime}`);

      const method = isNew ? 'POST' : 'PATCH';
      const url = isNew 
        ? `https://www.googleapis.com/calendar/v3/calendars/primary/events`
        : `https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.id}`;

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          summary: summary || 'Untitled Event',
          description,
          start: { dateTime: startObj.toISOString() },
          end: { dateTime: endObj.toISOString() }
        })
      });

      if (!res.ok) {
        if (res.status === 401) {
          await signOut(auth);
          localStorage.removeItem('googleAccessToken');
          return;
        }
        throw new Error("Failed to save event");
      }

      const updatedEvent = await res.json();
      onSave(updatedEvent, isNew);
    } catch (err) {
      console.error(err);
      alert('Failed to save event');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isNew || !onDelete) return;
    if (!confirm("Are you sure you want to delete this event?")) return;
    
    setIsDeleting(true);
    try {
      const token = localStorage.getItem('googleAccessToken');
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to delete");
      onDelete(event.id);
    } catch (err) {
      console.error(err);
      alert('Failed to delete event');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel" style={{ maxWidth: '500px', width: '90%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, color: '#fff', fontSize: '1.2rem' }}>{isNew ? 'Add Event' : 'Edit Appointment'}</h2>
          <button onClick={onClose} className="icon-btn" style={{ background: 'transparent', padding: '0.2rem' }}>
            <X size={20} color="#fff" />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Title</label>
            <input 
              type="text" 
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="chat-input"
              style={{ width: '100%' }}
              placeholder="Event Title"
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Start Date</label>
              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem', padding: '0.25rem' }}>
                <CalendarIcon size={16} color="var(--text-secondary)" style={{ marginLeft: '0.5rem' }} />
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#fff', padding: '0.5rem', flex: 1, outline: 'none', colorScheme: 'dark' }} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Start Time</label>
              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem', padding: '0.25rem' }}>
                <Clock size={16} color="var(--text-secondary)" style={{ marginLeft: '0.5rem' }} />
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#fff', padding: '0.5rem', flex: 1, outline: 'none', colorScheme: 'dark' }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>End Date</label>
              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem', padding: '0.25rem' }}>
                <CalendarIcon size={16} color="var(--text-secondary)" style={{ marginLeft: '0.5rem' }} />
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#fff', padding: '0.5rem', flex: 1, outline: 'none', colorScheme: 'dark' }} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>End Time</label>
              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem', padding: '0.25rem' }}>
                <Clock size={16} color="var(--text-secondary)" style={{ marginLeft: '0.5rem' }} />
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#fff', padding: '0.5rem', flex: 1, outline: 'none', colorScheme: 'dark' }} />
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Description / Notes</label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="chat-input"
              style={{ width: '100%', minHeight: '80px', resize: 'vertical' }}
              placeholder="Add notes or agenda here..."
            />
          </div>

          {!isNew && event?.htmlLink && (
            <div style={{ marginTop: '0.5rem' }}>
              <a href={event.htmlLink} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#38bdf8', textDecoration: 'none', fontSize: '0.85rem' }}>
                <ExternalLink size={14} /> Open in Google Calendar
              </a>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            {!isNew && (
              <button 
                className="btn" 
                onClick={handleDelete} 
                disabled={isDeleting || isSaving}
                style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0.5rem 1rem' }}>
                <Trash2 size={18} />
              </button>
            )}
            <button 
              className="btn" 
              onClick={handleSave} 
              disabled={isSaving || isDeleting}
              style={{ flex: 1, background: '#10b981', display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: isSaving ? 0.7 : 1 }}>
              <Save size={18} style={{ marginRight: '0.5rem' }} />
              {isSaving ? 'Saving...' : 'Save Event'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
