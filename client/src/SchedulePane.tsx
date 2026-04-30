import { useState } from 'react';
import { List as ListIcon, CalendarDays, CalendarRange, Plus } from 'lucide-react';

export default function SchedulePane({ meetings, onEventClick, onNewEvent, error }: { meetings: any[] | null, onEventClick: (event: any) => void, onNewEvent: () => void, error: string | null }) {
  const [view, setView] = useState<'list' | 'week' | 'calendar'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());

  if (error) {
    return (
      <div className="card-content">
        <p style={{ marginTop: '0.5rem', color: 'var(--danger)' }}>{error}</p>
      </div>
    );
  }

  if (meetings === null) {
    return (
      <div className="card-content">
        <div style={{ padding: '1rem 0', color: 'var(--text-secondary)' }}>Loading schedule...</div>
      </div>
    );
  }

  const renderListView = () => {
    if (meetings.length === 0) {
      return <div style={{ padding: '1rem 0', color: 'var(--text-secondary)' }}>No upcoming meetings. Enjoy your free time!</div>;
    }

    // Group meetings by day
    const grouped = meetings.reduce((acc, m) => {
      const start = new Date(m.start?.dateTime || m.start?.date);
      const dateKey = start.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(m);
      return acc;
    }, {} as Record<string, any[]>);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
        {Object.entries(grouped).map(([dateKey, dayMeetings]: [string, any]) => (
          <div key={dateKey}>
            <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.25rem' }}>{dateKey}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {dayMeetings.map((m: any, idx: number) => {
                const startTime = new Date(m.start?.dateTime || m.start?.date);
                const isAllDay = !m.start?.dateTime;
                return (
                  <div key={m.id || idx} className="list-item" style={{ cursor: 'pointer', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} onClick={() => onEventClick(m)}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 500, color: '#fff' }}>{m.summary || 'Untitled Event'}</span>
                      <span style={{ fontSize: '0.8rem', marginTop: '0.2rem', color: 'var(--text-secondary)' }}>
                        {isAllDay ? 'All Day' : startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderWeekView = () => {
    // Generate next 7 days
    const days = Array.from({length: 7}).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d;
    });

    return (
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
        {days.map((d, i) => {
          const dateStr = d.toLocaleDateString('en-GB');
          const dayMeetings = meetings.filter(m => {
            const mDate = new Date(m.start?.dateTime || m.start?.date);
            return mDate.toLocaleDateString('en-GB') === dateStr;
          });

          return (
            <div key={i} style={{ flex: '1 0 150px', background: 'rgba(255,255,255,0.02)', borderRadius: '0.5rem', padding: '0.75rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{d.toLocaleDateString('en-GB', { weekday: 'short' })}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 600, color: i === 0 ? '#38bdf8' : '#fff' }}>{d.getDate()}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {dayMeetings.map((m: any, idx: number) => {
                  const startTime = new Date(m.start?.dateTime || m.start?.date);
                  const isAllDay = !m.start?.dateTime;
                  return (
                    <div key={m.id || idx} style={{ background: 'rgba(56, 189, 248, 0.1)', borderLeft: '2px solid #38bdf8', padding: '0.5rem', borderRadius: '0.25rem', fontSize: '0.8rem', cursor: 'pointer' }} onClick={() => onEventClick(m)}>
                      <div style={{ fontWeight: 500, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.summary || 'Untitled Event'}</div>
                      <div style={{ color: 'rgba(255,255,255,0.6)', marginTop: '0.2rem' }}>{isAllDay ? 'All Day' : startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderCalendarView = () => {
    // Generate a simple calendar grid for the current month
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    // padding for first day (0 is Sunday, so if we want Monday start, adjust accordingly. We'll use local defaults)
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return (
      <div style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ margin: 0 }}>{currentDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h4>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="icon-btn" style={{ background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }} onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>&lt;</button>
            <button className="icon-btn" style={{ background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }} onClick={() => setCurrentDate(new Date())}>Today</button>
            <button className="icon-btn" style={{ background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }} onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>&gt;</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem' }}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.5rem 0' }}>{d}</div>
          ))}
          {days.map((d, i) => {
            if (!d) return <div key={i} style={{ background: 'transparent' }} />;
            const isToday = d.toLocaleDateString('en-GB') === new Date().toLocaleDateString('en-GB');
            const dateStr = d.toLocaleDateString('en-GB');
            const dayMeetings = meetings.filter(m => {
              const mDate = new Date(m.start?.dateTime || m.start?.date);
              return mDate.toLocaleDateString('en-GB') === dateStr;
            });

            return (
              <div key={i} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '0.25rem', padding: '0.25rem', minHeight: '60px', border: isToday ? '1px solid #38bdf8' : '1px solid transparent' }}>
                <div style={{ fontSize: '0.8rem', textAlign: 'right', color: isToday ? '#38bdf8' : '#fff', fontWeight: isToday ? 600 : 400 }}>{d.getDate()}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                  {dayMeetings.slice(0, 3).map((m: any, idx: number) => (
                    <div key={idx} onClick={() => onEventClick(m)} style={{ background: 'rgba(56, 189, 248, 0.2)', fontSize: '0.65rem', padding: '2px 4px', borderRadius: '2px', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}>
                      {m.summary}
                    </div>
                  ))}
                  {dayMeetings.length > 3 && <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textAlign: 'center' }}>+{dayMeetings.length - 3} more</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="card-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Your synced Google Calendar.</p>
        
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem', padding: '0.25rem' }}>
          <button 
            className="icon-btn" 
            style={{ padding: '0.25rem 0.5rem', background: view === 'list' ? 'rgba(255,255,255,0.1)' : 'transparent', borderRadius: '0.25rem' }}
            onClick={() => setView('list')} title="List View"
          >
            <ListIcon size={16} color={view === 'list' ? '#fff' : 'var(--text-secondary)'} />
          </button>
          <button 
            className="icon-btn" 
            style={{ padding: '0.25rem 0.5rem', background: view === 'week' ? 'rgba(255,255,255,0.1)' : 'transparent', borderRadius: '0.25rem' }}
            onClick={() => setView('week')} title="Week View"
          >
            <CalendarDays size={16} color={view === 'week' ? '#fff' : 'var(--text-secondary)'} />
          </button>
          <button 
            className="icon-btn" 
            style={{ padding: '0.25rem 0.5rem', background: view === 'calendar' ? 'rgba(255,255,255,0.1)' : 'transparent', borderRadius: '0.25rem' }}
            onClick={() => setView('calendar')} title="Month View"
          >
            <CalendarRange size={16} color={view === 'calendar' ? '#fff' : 'var(--text-secondary)'} />
          </button>
        </div>
      </div>

      {view === 'list' && renderListView()}
      {view === 'week' && renderWeekView()}
      {view === 'calendar' && renderCalendarView()}

      <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
        <button className="btn" style={{ background: '#f59e0b', color: '#000', display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={onNewEvent}>
          <Plus size={16} /> Modify / Add Schedule
        </button>
      </div>
    </div>
  );
}
