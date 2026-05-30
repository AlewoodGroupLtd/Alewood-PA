import { useState, useEffect } from 'react';
import { X, Save, ExternalLink, Calendar as CalendarIcon, Clock, Trash2 } from 'lucide-react';
import { auth } from './firebase';
import { signOut } from 'firebase/auth';

export default function EventModal({ event, onClose, onSave, onDelete }: { event: any, onClose: () => void, onSave: (updatedEvent: any, isNew?: boolean) => void, onDelete?: (eventId: string) => void }) {
  let initialPerson = '';
  let initialCompany = '';
  let initialDesc = event?.description || '';

  if (initialDesc) {
    const contactMatch = initialDesc.match(/Linked Contact: (.*)/);
    if (contactMatch) initialPerson = contactMatch[1].trim();

    const companyMatch = initialDesc.match(/Linked Company: (.*)/);
    if (companyMatch) initialCompany = companyMatch[1].trim();
    
    // Strip the linked block from description for editing
    initialDesc = initialDesc.split('\n\n---')[0].trim();
  }

  const [summary, setSummary] = useState(event?.summary || '');
  const [description, setDescription] = useState(initialDesc);
  const [people, setPeople] = useState<string[]>(initialPerson ? initialPerson.split(',').map(s => s.trim()).filter(Boolean) : []);
  const [companies, setCompanies] = useState<string[]>(initialCompany ? initialCompany.split(',').map(s => s.trim()).filter(Boolean) : []);

  const [personInput, setPersonInput] = useState('');
  const [companyInput, setCompanyInput] = useState('');

  const [companiesList, setCompaniesList] = useState<string[]>([]);
  const [peopleList, setPeopleList] = useState<string[]>([]);

  useEffect(() => {
    const fetchLists = async () => {
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
          if (hIdx !== -1) setCompaniesList([...new Set(compData.values.slice(3).map((r:any) => r[hIdx]).filter(Boolean))] as string[]);
        }
        if (peopleData.values && peopleData.values.length > 2) {
          const hIdx = peopleData.values[2].findIndex((h:string) => h.includes('Name') || h.includes('Person'));
          if (hIdx !== -1) setPeopleList([...new Set(peopleData.values.slice(3).map((r:any) => r[hIdx]).filter(Boolean))] as string[]);
        }
      } catch(e) {}
    };
    fetchLists();
  }, []);
  
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

      let finalDesc = description;
      if (people.length > 0 || companies.length > 0) {
        finalDesc += '\n\n---';
        if (people.length > 0) finalDesc += `\nLinked Contact: ${people.join(', ')}`;
        if (companies.length > 0) finalDesc += `\nLinked Company: ${companies.join(', ')}`;
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          summary: summary || 'Untitled Event',
          description: finalDesc,
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

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Linked Companies</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: companies.length ? '0.5rem' : 0 }}>
                {companies.map(c => (
                  <span key={c} style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {c} <X size={12} style={{ cursor: 'pointer' }} onClick={() => setCompanies(companies.filter(x => x !== c))} />
                  </span>
                ))}
              </div>
              <input 
                type="text" 
                list="event-companies" 
                value={companyInput} 
                onChange={e => setCompanyInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && companyInput.trim()) {
                    e.preventDefault();
                    if (!companies.includes(companyInput.trim())) setCompanies([...companies, companyInput.trim()]);
                    setCompanyInput('');
                  }
                }}
                className="chat-input" 
                style={{ width: '100%' }} 
                placeholder="Type and press Enter..." 
              />
              <datalist id="event-companies">{companiesList.map(c => <option key={c} value={c} />)}</datalist>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Linked Contacts</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: people.length ? '0.5rem' : 0 }}>
                {people.map(p => (
                  <span key={p} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {p} <X size={12} style={{ cursor: 'pointer' }} onClick={() => setPeople(people.filter(x => x !== p))} />
                  </span>
                ))}
              </div>
              <input 
                type="text" 
                list="event-people" 
                value={personInput} 
                onChange={e => setPersonInput(e.target.value)} 
                onKeyDown={e => {
                  if (e.key === 'Enter' && personInput.trim()) {
                    e.preventDefault();
                    if (!people.includes(personInput.trim())) setPeople([...people, personInput.trim()]);
                    setPersonInput('');
                  }
                }}
                className="chat-input" 
                style={{ width: '100%' }} 
                placeholder="Type and press Enter..." 
              />
              <datalist id="event-people">{peopleList.map(p => <option key={p} value={p} />)}</datalist>
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
                <Trash2 size={18} style={{ marginRight: '0.5rem' }} /> Delete Event
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
