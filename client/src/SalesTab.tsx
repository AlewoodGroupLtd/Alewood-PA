import React, { useState, useEffect } from 'react';
import { Users, Building2, Target, Plus, MessageSquare, Calendar, FileText, Activity } from 'lucide-react';

export default function SalesTab() {
  const [activeSubTab, setActiveSubTab] = useState<'Opportunities' | 'People' | 'Companies'>('Opportunities');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteType, setNoteType] = useState('Note');
  const [newActivityData, setNewActivityData] = useState({ date: '', person: '', company: '', notes: '' });
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // CRM Features State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc'|'desc'} | null>(null);
  
  // Edit State
  const [sheetHeaders, setSheetHeaders] = useState<Record<string, string[]>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  
  const SPREADSHEET_ID = '1_DvYuIUkKy903wKlRHeR953RsGBLynDu5bhBZ72yCO0';


  const loadDataFromSheets = async () => {
    setIsLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('googleAccessToken');
      if (!token) throw new Error("No Google Access Token found. Please re-login.");

      const fetchTab = async (tabName: string, headerIdx: number) => {
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${tabName}!A:AZ`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return [];
        const data = await res.json();
        const rows = data.values || [];
        if (rows.length <= headerIdx) return [];
        const headers = rows[headerIdx];
        
        // Save raw headers for exact mapping during edits
        setSheetHeaders(prev => ({ ...prev, [tabName]: headers }));
        
        return rows.slice(headerIdx + 1).map((row: any[], idx: number) => {
          const obj: any = { id: `${tabName}-${idx + headerIdx + 2}`, _sheetTab: tabName, _rowIndex: idx + headerIdx + 2 };
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
    if (!newActivityData.notes.trim() || !selectedItem) return;
    
    const token = localStorage.getItem('googleAccessToken');
    if (!token) {
      alert("No Google Access Token. Please login again.");
      return;
    }

    // Optimistic UI Update
    const newActivity = {
      id: `temp-${Date.now()}`,
      type: noteType,
      notes: newActivityData.notes,
      date: newActivityData.date,
      person: newActivityData.person,
      company: newActivityData.company
    };
    
    setActivities([newActivity, ...activities]);
    setIsAddingNote(false);
    
    try {
      const headers = sheetHeaders['Activities'] || ['Person', 'Company', 'Type', 'Date', 'Notes'];
      const newActivityObj: any = {
        person: newActivityData.person,
        company: newActivityData.company,
        type: noteType,
        date: newActivityData.date,
        notes: newActivityData.notes
      };

      const rowData = headers.map((header: string) => {
        const key = header.toLowerCase().replace(/\s+/g, '');
        return newActivityObj[key] || '';
      });
      
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Activities!A:AZ:append?valueInputOption=USER_ENTERED`, {
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
      
      // Clear after save
      setNewActivityData({ date: '', person: '', company: '', notes: '' });
      
    } catch (e) {
      console.error(e);
      alert("Error saving note to Google Sheets.");
      // Rollback optimistic update
      setActivities(activities.filter(a => a.id !== newActivity.id));
    }
  };

  const handleEditSave = async () => {
    const token = localStorage.getItem('googleAccessToken');
    if (!token) {
      alert("No Google Access Token. Please login again.");
      return;
    }

    const tabName = selectedItem._sheetTab || activeSubTab;
    const rowIndex = selectedItem._rowIndex;
    const headers = sheetHeaders[tabName];
    if (!headers) return;

    // Map editFormData back to array matching headers
    const rowData = headers.map(header => {
      const key = header.toLowerCase().replace(/\s+/g, '');
      return editFormData[key] || '';
    });

    try {
      if (rowIndex) {
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${tabName}!A${rowIndex}?valueInputOption=USER_ENTERED`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            values: [rowData]
          })
        });
        if (!res.ok) throw new Error("Failed to save edits");
      } else {
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${tabName}!A:AZ:append?valueInputOption=USER_ENTERED`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            values: [rowData]
          })
        });
        if (!res.ok) throw new Error("Failed to create new item");
      }
      
      // Update local state by reloading from sheets to get exact row indexes
      await loadDataFromSheets();
      setSelectedItem(null);
      setIsEditing(false);
      
    } catch (e) {
      console.error(e);
      alert("Error saving to Google Sheets.");
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc'|'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getFilteredAndSortedData = (data: any[]) => {
    let filtered = data;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = data.filter(item => 
        Object.values(item).some(val => 
          String(val).toLowerCase().includes(q)
        )
      );
    }

    if (sortConfig) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortConfig.key] || '';
        const bVal = b[sortConfig.key] || '';
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  };

  const renderSortableHeader = (label: string, sortKey: string) => (
    <th onClick={() => handleSort(sortKey)} style={{ cursor: 'pointer', userSelect: 'none' }}>
      {label} {sortConfig?.key === sortKey ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
    </th>
  );

  const renderColoredValue = (key: string, value: any) => {
    if (!value) return null;
    const strVal = String(value).toLowerCase();
    
    if (key === 'status' || key === 'stage') {
      let color = '#38bdf8'; 
      let bg = 'rgba(56, 189, 248, 0.2)';
      if (strVal.includes('won') || strVal.includes('active') || strVal.includes('qualified')) {
        color = '#10b981'; bg = 'rgba(16, 185, 129, 0.2)';
      } else if (strVal.includes('lost') || strVal.includes('closed')) {
        color = '#ef4444'; bg = 'rgba(239, 68, 68, 0.2)';
      } else if (strVal.includes('open') || strVal.includes('negotiation') || strVal.includes('progress') || strVal.includes('prospect')) {
        color = '#f59e0b'; bg = 'rgba(245, 158, 11, 0.2)';
      }
      return <span className="badge" style={{ background: bg, color, padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600 }}>{value as React.ReactNode}</span>;
    }
    
    if (key === 'priorityscore' || key === 'priority') {
      const score = parseInt(value);
      let color = '#fff';
      if (score >= 8 || strVal === 'high') color = '#ef4444';
      else if (score >= 4 || strVal === 'medium') color = '#f59e0b';
      else color = '#10b981';
      return <strong style={{ color }}>{value}</strong>;
    }
    
    return <span style={{ color: '#fff', fontWeight: 500 }}>{value as React.ReactNode}</span>;
  };

  const renderOpportunities = () => {
    const data = getFilteredAndSortedData(opportunities);
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              {renderSortableHeader('Company', 'company')}
              {renderSortableHeader('Name', 'name')}
              {renderSortableHeader('Value', 'value')}
              {renderSortableHeader('Status', 'status')}
            </tr>
          </thead>
          <tbody>
            {data.map(opp => (
              <tr key={opp.id} onClick={() => setSelectedItem(opp)} style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="table-row-hover">
                <td style={{ padding: '0.8rem 0' }}>{opp.company || opp.companyname}</td>
                <td>{opp.name || opp.opportunityname || opp.title}</td>
                <td style={{ color: '#10b981' }}>{opp.value || opp.amount}</td>
                <td>{renderColoredValue('status', opp.status || opp.stage)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderPeople = () => {
    const data = getFilteredAndSortedData(people);
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              {renderSortableHeader('Name', 'name')}
              {renderSortableHeader('Company', 'company')}
              {renderSortableHeader('Title', 'title')}
              {renderSortableHeader('Website', 'workwebsite')}
              {renderSortableHeader('LinkedIn', 'linkedin')}
            </tr>
          </thead>
          <tbody>
            {data.map(person => (
              <tr key={person.id} onClick={() => setSelectedItem(person)} style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="table-row-hover">
                <td style={{ padding: '0.8rem 0' }}>{person.name || person.fullname}</td>
                <td>{person.company}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{person.title || person.role}</td>
                <td><a href={person.workwebsite?.startsWith('http') ? person.workwebsite : `https://${person.workwebsite}`} target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }} onClick={e => e.stopPropagation()}>{person.workwebsite}</a></td>
                <td><a href={person.linkedin?.startsWith('http') ? person.linkedin : `https://${person.linkedin}`} target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }} onClick={e => e.stopPropagation()}>{person.linkedin ? 'Profile' : ''}</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderCompanies = () => {
    const data = getFilteredAndSortedData(companies);
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              {renderSortableHeader('Company Name', 'companyname')}
              {renderSortableHeader('Contact Type', 'contacttype')}
              {renderSortableHeader('Type', 'type')}
              {renderSortableHeader('System', 'currentsystem')}
              {renderSortableHeader('Priority', 'priorityscore')}
              {renderSortableHeader('Website', 'workwebsite')}
              {renderSortableHeader('Headcount', 'headcount')}
              {renderSortableHeader('Turnover', 'turnover')}
              {renderSortableHeader('Est Case Vol', 'estimatedcasevolume')}
            </tr>
          </thead>
          <tbody>
            {data.map(company => (
              <tr key={company.id} onClick={() => setSelectedItem(company)} style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="table-row-hover">
                <td style={{ padding: '0.8rem 0' }}>{company.companyname || company.name}</td>
                <td>{company.contacttype}</td>
                <td>{company.type}</td>
                <td>{company.currentsystem}</td>
                <td>{renderColoredValue('priorityscore', company.priorityscore)}</td>
                <td><a href={company.workwebsite?.startsWith('http') ? company.workwebsite : `https://${company.workwebsite}`} target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }} onClick={e => e.stopPropagation()}>{company.workwebsite}</a></td>
                <td>{company.headcount}</td>
                <td>{company.turnover}</td>
                <td>{company.estimatedcasevolume}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderDetailView = () => {
    if (!selectedItem) return null;
    
    const activeTabObj = selectedItem._sheetTab || activeSubTab;
    let targetTitle = '';
    if (activeTabObj === 'People') targetTitle = selectedItem.name || selectedItem.fullname || '';
    else if (activeTabObj === 'Companies') targetTitle = selectedItem.companyname || selectedItem.name || '';
    else targetTitle = selectedItem.opportunityname || selectedItem.title || selectedItem.name || '';
    const headers = sheetHeaders[selectedItem._sheetTab || activeSubTab] || [];
    
    // Filter activities related to this item
    const itemActivities = activities.filter(a => {
      if (activeSubTab === 'People') {
        return a.person === targetTitle;
      } else if (activeSubTab === 'Companies') {
        return a.company === targetTitle;
      } else {
        // Opportunities
        const oppCompany = selectedItem.company || selectedItem.companyname;
        const oppPerson = selectedItem.contact || selectedItem.person;
        return (oppCompany && a.company === oppCompany) || (oppPerson && a.person === oppPerson);
      }
    });

    const relatedPeople = (selectedItem._sheetTab === 'Companies' || activeSubTab === 'Companies') 
      ? people.filter(p => p.company === targetTitle || p.companyname === targetTitle)
      : [];

    return (
      <div className="card glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>
            {isEditing && !selectedItem._rowIndex ? `New ${activeSubTab.slice(0, -1)}` : targetTitle}
          </h2>
          <div>
            {!isEditing ? (
              <button className="btn" style={{ marginRight: '0.5rem' }} onClick={() => { setEditFormData(selectedItem); setIsEditing(true); }}>Edit</button>
            ) : (
              <button className="btn primary" style={{ marginRight: '0.5rem' }} onClick={handleEditSave}>Save</button>
            )}
            <button className="icon-btn" onClick={() => { setSelectedItem(null); setIsEditing(false); }}>
              <Activity size={18} style={{ transform: 'rotate(45deg)' }} />
            </button>
          </div>
        </div>
        
        <div className="card-content" style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', marginBottom: '1.5rem' }}>
            {isEditing ? (
              headers.map((header: string) => {
                if (!header) return null;
                const key = header.toLowerCase().replace(/\s+/g, '');
                return (
                  <div key={key} style={{ display: 'flex', marginBottom: '0.5rem', alignItems: 'center' }}>
                    <span style={{ width: '150px', color: 'var(--text-secondary)' }}>{header}:</span>
                    <input 
                      type="text" 
                      className="input-field" 
                      style={{ flex: 1, padding: '0.3rem 0.5rem' }}
                      value={editFormData[key] || ''}
                      onChange={(e) => setEditFormData({...editFormData, [key]: e.target.value})}
                    />
                  </div>
                );
              })
            ) : (
              headers.map((header: string) => {
                if (!header) return null;
                const key = header.toLowerCase().replace(/\s+/g, '');
                const value = selectedItem[key] || '-';
                return (
                  <div key={key} style={{ display: 'flex', marginBottom: '0.5rem' }}>
                    <span style={{ width: '150px', color: 'var(--text-secondary)' }}>{header}:</span>
                    {renderColoredValue(key, value)}
                  </div>
                );
              })
            )}
          </div>

          {!isEditing && relatedPeople.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', marginBottom: '1rem' }}>Related Contacts</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {relatedPeople.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.8rem', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
                    <div>
                      <div style={{ color: '#fff', fontWeight: 500 }}>{p.name || p.fullname}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{p.title || p.role}</div>
                    </div>
                    <div style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      <div>{p.email || p.emailaddress}</div>
                      <div>{p.phone || p.mobile}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isEditing && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Activity History</h3>
            <button className="btn primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={() => {
              if (!isAddingNote) {
                setNewActivityData({
                  date: new Date().toISOString().split('T')[0],
                  person: activeSubTab === 'People' ? (selectedItem.name || selectedItem.fullname || selectedItem.contact || '') : (selectedItem.contact || selectedItem.person || ''),
                  company: activeSubTab === 'Companies' ? (selectedItem.name || selectedItem.companyname || selectedItem.company || '') : (selectedItem.company || selectedItem.companyname || ''),
                  notes: ''
                });
              }
              setIsAddingNote(!isAddingNote);
            }}>
              <Plus size={14} /> Log Activity
            </button>
          </div>

          {isAddingNote && (
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Date</label>
                  <input type="date" className="input-field" style={{ width: '100%', padding: '0.4rem' }} value={newActivityData.date} onChange={e => setNewActivityData({...newActivityData, date: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Type</label>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                    {['Note', 'Conversation', 'Meeting'].map(type => (
                      <button key={type} className={`btn ${noteType === type ? 'primary' : ''}`} style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', flex: 1, background: noteType === type ? '' : 'rgba(255,255,255,0.1)' }} onClick={() => setNoteType(type)}>
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Person</label>
                  <input type="text" className="input-field" style={{ width: '100%', padding: '0.4rem' }} value={newActivityData.person} onChange={e => setNewActivityData({...newActivityData, person: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Company</label>
                  <input type="text" className="input-field" style={{ width: '100%', padding: '0.4rem' }} value={newActivityData.company} onChange={e => setNewActivityData({...newActivityData, company: e.target.value})} />
                </div>
              </div>
              <textarea 
                className="input-field" 
                style={{ width: '100%', height: '80px', marginBottom: '1rem' }}
                placeholder={`Type your ${noteType.toLowerCase()} details here...`}
                value={newActivityData.notes}
                onChange={(e) => setNewActivityData({...newActivityData, notes: e.target.value})}
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
            </>
          )}
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
            onClick={() => { setActiveSubTab('Opportunities'); setSelectedItem(null); setIsEditing(false); }}
            style={{ margin: 0, flex: 1, justifyContent: 'center' }}
          >
            <Target size={16} /> Opportunities
          </button>
          <button 
            className={`tab ${activeSubTab === 'People' ? 'active' : ''}`}
            onClick={() => { setActiveSubTab('People'); setSelectedItem(null); setIsEditing(false); }}
            style={{ margin: 0, flex: 1, justifyContent: 'center' }}
          >
            <Users size={16} /> People
          </button>
          <button 
            className={`tab ${activeSubTab === 'Companies' ? 'active' : ''}`}
            onClick={() => { setActiveSubTab('Companies'); setSelectedItem(null); setIsEditing(false); }}
            style={{ margin: 0, flex: 1, justifyContent: 'center' }}
          >
            <Building2 size={16} /> Companies
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input 
            type="text" 
            className="input-field" 
            placeholder="Search..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ flex: 1 }}
          />
          <button 
            className="btn primary" 
            onClick={() => { 
              setSelectedItem({ _sheetTab: activeSubTab }); 
              setEditFormData({}); 
              setIsEditing(true); 
            }}
          >
            <Plus size={16} /> New {activeSubTab.slice(0, -1)}
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
