import React, { useState, useEffect } from 'react';
import { Users, Building2, Target, Plus, MessageSquare, Calendar, FileText, Activity } from 'lucide-react';

export default function SalesTab() {
  const [activeSubTab, setActiveSubTab] = useState<'Opportunities' | 'People' | 'Companies'>('Opportunities');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteType, setNoteType] = useState('Note');
  const [noteText, setNoteText] = useState('');
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const SPREADSHEET_ID = '1_DvYuIUkKy903wKlRHeR953RsGBLynDu5bhBZ72yCO0';


  const loadDataFromSheets = async () => {
    setIsLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('googleAccessToken');
      if (!token) throw new Error("No Google Access Token found. Please re-login.");

      const fetchTab = async (tabName: string, headerIdx: number) => {
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${tabName}!A:J`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return [];
        const data = await res.json();
        const rows = data.values || [];
        if (rows.length <= headerIdx) return [];
        const headers = rows[headerIdx];
        return rows.slice(headerIdx + 1).map((row: any[], idx: number) => {
          const obj: any = { id: `${tabName}-${idx + headerIdx + 2}` }; // 1-indexed + header + 1
          headers.forEach((header: string, i: number) => {
            if (header) {
              obj[header.toLowerCase().replace(/\s+/g, '')] = row[i] || '';
            }
          });
          return obj;
        });
      };

      const [oppsData, peopleData, companiesData, activitiesData] = await Promise.all([
        fetchTab('Opportunities', 2), // Header in row 3
        fetchTab('People', 2),        // Header in row 3
        fetchTab('Companies', 2),     // Header in row 3
        fetchTab('Activities', 3)     // Header in row 4
      ]);

      setOpportunities(oppsData);
      setPeople(peopleData);
      setCompanies(companiesData);
      setActivities(activitiesData);
    } catch (e: any) {
      console.error("Failed to load from sheets", e);
      setError(e.message || "Failed to load CRM data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDataFromSheets();
  }, []);

  const handleAddNote = async () => {
    if (!noteText.trim() || !selectedItem) return;
    
    const token = localStorage.getItem('googleAccessToken');
    if (!token) {
      alert("No Google Access Token. Please login again.");
      return;
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const personName = activeSubTab === 'People' ? (selectedItem.name || selectedItem.fullname || selectedItem.contact || '') : (selectedItem.contact || selectedItem.person || '');
    const companyName = activeSubTab === 'Companies' ? (selectedItem.name || selectedItem.companyname || selectedItem.company || '') : (selectedItem.company || selectedItem.companyname || '');
    const targetTitle = selectedItem.title || selectedItem.opportunityname || selectedItem.name || '';

    // Optimistic UI Update
    const newActivity = {
      id: `temp-${Date.now()}`,
      relatedto: targetTitle,
      type: noteType,
      text: noteText,
      date: dateStr,
      person: personName,
      company: companyName
    };
    
    setActivities([newActivity, ...activities]);
    setIsAddingNote(false);
    setNoteText('');
    setNoteType('Note');
    
    try {
      // Append to 'Activities' sheet
      // Assuming columns: Date, Type, Person, Company, Related To, Text
      const rowData = [dateStr, noteType, personName, companyName, targetTitle, noteText];
      
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Activities!A:F:append?valueInputOption=USER_ENTERED`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [rowData]
        })
      });
      
      if (!res.ok) {
        throw new Error("Failed to save note to Google Sheets");
      }
    } catch (e) {
      console.error(e);
      alert("Error saving note to Google Sheets.");
      // Rollback optimistic update
      setActivities(activities.filter(a => a.id !== newActivity.id));
    }
  };

  const renderOpportunities = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
      {opportunities.map(opp => (
        <div key={opp.id} className="card glass-panel" style={{ cursor: 'pointer' }} onClick={() => setSelectedItem(opp)}>
          <div className="card-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>{opp.title || opp.opportunityname || opp.name || opp.opportunity}</h3>
              <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8' }}>{opp.stage || opp.status || 'Active'}</span>
            </div>
            <div style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Building2 size={14} /> {opp.company || opp.companyname || 'Unknown Company'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Users size={14} /> {opp.contact || opp.person || opp.contactname || 'Unassigned'}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <strong style={{ color: '#10b981' }}>{opp.value || opp.amount || opp.expectedvalue || '-'}</strong>
                <span style={{ fontSize: '0.85rem' }}>Updated: {opp.lastactivity || opp.updated || opp.date || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderPeople = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {people.map(person => (
        <div key={person.id} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', cursor: 'pointer' }} onClick={() => setSelectedItem(person)}>
          <div>
            <h4 style={{ margin: 0, color: '#fff' }}>{person.name || person.fullname || person.contact}</h4>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>{person.role || person.jobtitle || person.title} at {person.company || person.companyname}</div>
          </div>
          <div style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            <div>{person.email || person.emailaddress}</div>
            <div>{person.phone || person.phonenumber || person.mobile}</div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderCompanies = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {companies.map(company => (
        <div key={company.id} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', cursor: 'pointer' }} onClick={() => setSelectedItem(company)}>
          <div>
            <h4 style={{ margin: 0, color: '#fff' }}>{company.name || company.companyname || company.company}</h4>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>{company.industry || company.sector}</div>
          </div>
          <div style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            <div>{company.employees || company.size ? `${company.employees || company.size} employees` : ''}</div>
            <a href={`https://${company.website || company.domain}`} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }} onClick={(e) => e.stopPropagation()}>{company.website || company.domain}</a>
          </div>
        </div>
      ))}
    </div>
  );

  const renderDetailView = () => {
    if (!selectedItem) return null;
    
    const targetTitle = selectedItem.title || selectedItem.opportunityname || selectedItem.name || '';
    
    // Filter activities related to this item
    const itemActivities = activities.filter(a => 
      a.relatedto === targetTitle || 
      a.person === targetTitle || 
      a.company === targetTitle
    );

    return (
      <div className="card glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <h2 style={{ margin: 0 }}>
            {targetTitle}
          </h2>
          <button className="icon-btn" onClick={() => setSelectedItem(null)}>
            <Activity size={18} />
          </button>
        </div>
        
        <div className="card-content" style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', marginBottom: '1.5rem' }}>
            {Object.entries(selectedItem).map(([key, value]) => {
              if (key === 'id') return null;
              return (
                <div key={key} style={{ display: 'flex', marginBottom: '0.5rem' }}>
                  <span style={{ width: '120px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{key}:</span>
                  <span style={{ color: '#fff', fontWeight: 500 }}>{value as React.ReactNode}</span>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Activity History</h3>
            <button className="btn primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={() => setIsAddingNote(!isAddingNote)}>
              <Plus size={14} /> Log Activity
            </button>
          </div>

          {isAddingNote && (
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                {['Note', 'Conversation', 'Meeting'].map(type => (
                  <button 
                    key={type}
                    className={`btn ${noteType === type ? 'primary' : ''}`}
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem', background: noteType === type ? '' : 'rgba(255,255,255,0.1)' }}
                    onClick={() => setNoteType(type)}
                  >
                    {type === 'Note' ? <FileText size={12} /> : type === 'Meeting' ? <Calendar size={12} /> : <MessageSquare size={12} />}
                    {type}
                  </button>
                ))}
              </div>
              <textarea 
                className="input-field" 
                style={{ width: '100%', height: '80px', marginBottom: '1rem' }}
                placeholder={`Type your ${noteType.toLowerCase()} details here...`}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button className="btn" style={{ background: 'transparent' }} onClick={() => setIsAddingNote(false)}>Cancel</button>
                <button className="btn primary" onClick={handleAddNote}>Save to Sheets</button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {itemActivities.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No activities logged yet.</div>
            ) : itemActivities.map(act => (
              <div key={act.id} style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderLeft: `3px solid ${act.type === 'Meeting' ? '#f59e0b' : act.type === 'Conversation' ? '#38bdf8' : '#10b981'}`, borderRadius: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <strong style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#fff', fontSize: '0.9rem' }}>
                    {act.type === 'Note' ? <FileText size={14} /> : act.type === 'Meeting' ? <Calendar size={14} /> : <MessageSquare size={14} />}
                    {act.type}
                  </strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{act.date}</span>
                </div>
                <div style={{ color: '#e2e8f0', fontSize: '0.95rem', lineHeight: 1.5 }}>
                  {act.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selectedItem ? '1fr 1fr' : '1fr', gap: '1.5rem', height: 'calc(100vh - 180px)' }}>
      
      {/* Left List View */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
        <div className="card glass-panel" style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button 
            className={`tab ${activeSubTab === 'Opportunities' ? 'active' : ''}`}
            onClick={() => { setActiveSubTab('Opportunities'); setSelectedItem(null); }}
            style={{ margin: 0, flex: 1, justifyContent: 'center' }}
          >
            <Target size={16} /> Opportunities
          </button>
          <button 
            className={`tab ${activeSubTab === 'People' ? 'active' : ''}`}
            onClick={() => { setActiveSubTab('People'); setSelectedItem(null); }}
            style={{ margin: 0, flex: 1, justifyContent: 'center' }}
          >
            <Users size={16} /> People
          </button>
          <button 
            className={`tab ${activeSubTab === 'Companies' ? 'active' : ''}`}
            onClick={() => { setActiveSubTab('Companies'); setSelectedItem(null); }}
            style={{ margin: 0, flex: 1, justifyContent: 'center' }}
          >
            <Building2 size={16} /> Companies
          </button>
        </div>

        {error && <div style={{ color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px' }}>{error}</div>}
        
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Loading data from Google Sheets...</div>
        ) : (
          <div style={{ overflowY: 'auto', paddingRight: '0.5rem' }}>
            {activeSubTab === 'Opportunities' && renderOpportunities()}
            {activeSubTab === 'People' && renderPeople()}
            {activeSubTab === 'Companies' && renderCompanies()}
          </div>
        )}
      </div>

      {/* Right Detail View */}
      {selectedItem && (
        <div style={{ height: '100%' }}>
          {renderDetailView()}
        </div>
      )}

    </div>
  );
}
