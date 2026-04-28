import { useState } from 'react';
import { X, Save, ExternalLink } from 'lucide-react';

export default function EventModal({ event, onClose, onSave }: { event: any, onClose: () => void, onSave: (updatedEvent: any) => void }) {
  const [summary, setSummary] = useState(event.summary || '');
  const [description, setDescription] = useState(event.description || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('googleAccessToken');
      if (!token) throw new Error("No token");

      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          summary,
          description
        })
      });

      if (!res.ok) {
        throw new Error("Failed to update event");
      }

      const updatedEvent = await res.json();
      onSave(updatedEvent);
    } catch (err) {
      console.error(err);
      alert('Failed to update event');
    } finally {
      setIsSaving(false);
    }
  };

  const isAllDay = !event.start?.dateTime;
  const startTime = isAllDay ? new Date(event.start?.date) : new Date(event.start?.dateTime);

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel" style={{ maxWidth: '500px', width: '90%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, color: '#fff', fontSize: '1.2rem' }}>Edit Appointment</h2>
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
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Date / Time</label>
            <div style={{ color: '#e2e8f0', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '0.25rem', fontSize: '0.9rem' }}>
              {isAllDay ? `All Day - ${startTime.toLocaleDateString()}` : `${startTime.toLocaleDateString()} at ${startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Description / Notes</label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="chat-input"
              style={{ width: '100%', minHeight: '100px', resize: 'vertical' }}
              placeholder="Add notes or agenda here..."
            />
          </div>

          {event.htmlLink && (
            <div style={{ marginTop: '0.5rem' }}>
              <a href={event.htmlLink} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#38bdf8', textDecoration: 'none', fontSize: '0.85rem' }}>
                <ExternalLink size={14} /> Open in Google Calendar
              </a>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button 
              className="btn" 
              onClick={handleSave} 
              disabled={isSaving}
              style={{ flex: 1, background: '#10b981', display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: isSaving ? 0.7 : 1 }}>
              <Save size={18} style={{ marginRight: '0.5rem' }} />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
