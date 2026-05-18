import React, { useState, useEffect } from 'react';
import { Users, Building2, Target, Plus, MessageSquare, Calendar, FileText, Activity } from 'lucide-react';

export default function SalesTab() {
  const [activeSubTab, setActiveSubTab] = useState<'Opportunities' | 'People' | 'Companies' | 'Tasks'>('Opportunities');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteType, setNoteType] = useState('Note');
  const [newActivityData, setNewActivityData] = useState({ date: '', person: '', company: '', notes: '' });
  
  // Meeting Scheduler State
  const [isSettingUpMeeting, setIsSettingUpMeeting] = useState(false);
  const [meetingFormData, setMeetingFormData] = useState({ date: '', startTime: '14:00', endTime: '15:00', type: 'Google Meet', personName: '', personEmail: '', companyName: '', allowGemini: false });

  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // CRM Features State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc'|'desc'} | null>(null);
  
  // Edit State
  const [sheetHeaders, setSheetHeaders] = useState<Record<string, string[]>>({});
  const [sheetRowCounts, setSheetRowCounts] = useState<Record<string, number>>({});
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
        setSheetRowCounts(prev => ({ ...prev, [tabName]: rows.length }));
        
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

      const [oppsData, peopleData, companiesData, activitiesData, tasksData] = await Promise.all([
        fetchTab('Opportunities', 2), // Header in row 3
        fetchTab('People', 2),        // Header in row 3
        fetchTab('Companies', 2),     // Header in row 3
        fetchTab('Activities', 3),    // Header in row 4
        fetchTab('Tasks', 0)          // Header in row 1
      ]);

      setOpportunities(oppsData);
      setPeople(peopleData);
      setCompanies(companiesData);
      setActivities(activitiesData);
      setTasks(tasksData);
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
      
      const targetRow = (sheetRowCounts['Activities'] || headers.length) + 1;
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Activities!A${targetRow}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
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
      
      setSheetRowCounts(prev => ({ ...prev, 'Activities': targetRow }));
      
      // Clear after save
      setNewActivityData({ date: '', person: '', company: '', notes: '' });
      
    } catch (e) {
      console.error(e);
      alert("Error saving note to Google Sheets.");
      // Rollback optimistic update
      setActivities(activities.filter(a => a.id !== newActivity.id));
    }
  };

  const handleCreateMeeting = async () => {
    if (!meetingFormData.date || !meetingFormData.startTime || !meetingFormData.endTime) {
      alert("Please provide date, start time, and end time.");
      return;
    }

    const token = localStorage.getItem('googleAccessToken');
    if (!token) {
      alert("No Google Access Token. Please login again.");
      return;
    }

    setIsSettingUpMeeting(false);

    try {
      // 1. Create Google Calendar Event
      const startDateTime = `${meetingFormData.date}T${meetingFormData.startTime}:00`;
      const endDateTime = `${meetingFormData.date}T${meetingFormData.endTime}:00`;

      const eventPayload: any = {
        summary: `Meeting with ${meetingFormData.personName || meetingFormData.companyName}`,
        description: meetingFormData.allowGemini ? "Gemini Moltbot will join to take notes." : "",
        start: { dateTime: startDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        end: { dateTime: endDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        attendees: meetingFormData.personEmail ? [{ email: meetingFormData.personEmail }] : []
      };

      let url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

      if (meetingFormData.type === 'Google Meet') {
        url += '?conferenceDataVersion=1';
        eventPayload.conferenceData = {
          createRequest: {
            requestId: `meet-${Date.now()}`,
            conferenceSolutionKey: { type: "hangoutsMeet" }
          }
        };
      }

      const calRes = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventPayload)
      });

      if (!calRes.ok) {
        throw new Error("Failed to create Google Calendar event.");
      }

      // 2. Log Activity to Sheets
      const newActivity = {
        id: `temp-meet-${Date.now()}`,
        type: 'Meeting',
        notes: `Scheduled Meeting (${meetingFormData.type}). ${meetingFormData.allowGemini ? '[Gemini Notes Enabled]' : ''}`,
        date: meetingFormData.date,
        person: meetingFormData.personName,
        company: meetingFormData.companyName
      };

      setActivities([newActivity, ...activities]);

      const headers = sheetHeaders['Activities'] || ['Person', 'Company', 'Type', 'Date', 'Notes'];
      const newActivityObj: any = {
        person: newActivity.person,
        company: newActivity.company,
        type: newActivity.type,
        date: newActivity.date,
        notes: newActivity.notes
      };

      const rowData = headers.map((header: string) => {
        const key = header.toLowerCase().replace(/\s+/g, '');
        return newActivityObj[key] || '';
      });
      
      const targetRow = (sheetRowCounts['Activities'] || 0) + 1;
      const sheetRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Activities!A${targetRow}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [rowData]
        })
      });

      if (!sheetRes.ok) {
        throw new Error("Failed to log activity to Google Sheets.");
      }
      
      setSheetRowCounts(prev => ({ ...prev, 'Activities': targetRow }));
      
      setIsSettingUpMeeting(false);
      setMeetingFormData({ date: '', startTime: '14:00', endTime: '15:00', type: 'Google Meet', personName: '', personEmail: '', companyName: '', allowGemini: false });
      
      alert("Meeting successfully scheduled and logged!");

    } catch (e: any) {
      console.error(e);
      alert(e.message || "Error scheduling meeting.");
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
      if (!header) return '';
      const key = header.toLowerCase().replace(/\s+/g, '');
      return editFormData[key] || '';
    });

    try {
      let targetRowIndex = rowIndex;
      let isNew = false;
      if (!targetRowIndex) {
        targetRowIndex = (sheetRowCounts[tabName] || headers.length) + 1;
        isNew = true;
      }

      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${tabName}!A${targetRowIndex}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [rowData]
        })
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to save edits (HTTP ${res.status}): ${errorText}`);
      }

      if (isNew) {
        setSheetRowCounts(prev => ({ ...prev, [tabName]: targetRowIndex }));
      }

      // Auto-create company if it doesn't exist
      if (tabName === 'People' && editFormData.company) {
        const companyName = editFormData.company.trim();
        const existingCompany = companies.find(c => (c.companyname || c.name)?.toLowerCase() === companyName.toLowerCase());
        
        if (!existingCompany) {
          const compHeaders = sheetHeaders['Companies'];
          if (compHeaders) {
            const newCompanyRowData = compHeaders.map(header => {
              if (!header) return '';
              const key = header.toLowerCase().replace(/\s+/g, '');
              if (key === 'companyname' || key === 'name') return companyName;
              return '';
            });
            
            const targetCompRowIndex = (sheetRowCounts['Companies'] || compHeaders.length) + 1;
            const compRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Companies!A${targetCompRowIndex}?valueInputOption=USER_ENTERED`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ values: [newCompanyRowData] })
            });
            
            if (compRes.ok) {
              setSheetRowCounts(prev => ({ ...prev, 'Companies': targetCompRowIndex }));
            }
          }
        }
      }

      await loadDataFromSheets();
      setIsEditing(false);
      setSelectedItem(null);
    } catch (e: any) {
      console.error(e);
      alert(`Error saving data to Google Sheets: ${e.message || e}`);
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
      if (score >= 8 || strVal === 'high') color = '#10b981'; // Green for high
      else if (score >= 4 || strVal === 'medium') color = '#f59e0b'; // Amber for medium
      else color = '#ef4444'; // Red for low
      return <strong style={{ color }}>{value}</strong>;
    }
    
    if (key.includes('email')) {
      return <a href={`https://mail.google.com/mail/?view=cm&fs=1&to=${value}`} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 500 }} onClick={e => e.stopPropagation()}>{value as React.ReactNode}</a>;
    }

    if (key.includes('website') || key.includes('linkedin')) {
      const url = String(value).startsWith('http') ? value : `https://${value}`;
      return <a href={url} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 500 }} onClick={e => e.stopPropagation()}>{value as React.ReactNode}</a>;
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

  const renderTasks = () => {
    const data = getFilteredAndSortedData(tasks);
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              {renderSortableHeader('Date', 'date')}
              {renderSortableHeader('Person', 'person')}
              {renderSortableHeader('Company', 'company')}
              {renderSortableHeader('Due Date', 'duedate')}
              {renderSortableHeader('Task', 'task')}
              {renderSortableHeader('Status', 'status')}
            </tr>
          </thead>
          <tbody>
            {data.map(t => (
              <tr key={t.id} onClick={() => setSelectedItem(t)} style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="table-row-hover">
                <td style={{ padding: '0.8rem 0', whiteSpace: 'nowrap' }}>{t.date}</td>
                <td>{t.person}</td>
                <td>{t.company}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{t.duedate}</td>
                <td style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '300px' }}>{t.task}</td>
                <td>{renderColoredValue('status', t.status)}</td>
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
    else if (activeTabObj === 'Tasks') targetTitle = selectedItem.task || 'Task Detail';
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

    // Filter tasks related to this item
    const itemTasks = tasks.filter(t => {
      if (activeSubTab === 'People') {
        return t.person === targetTitle;
      } else if (activeSubTab === 'Companies') {
        return t.company === targetTitle;
      } else {
        // Opportunities
        const oppCompany = selectedItem.company || selectedItem.companyname;
        const oppPerson = selectedItem.contact || selectedItem.person;
        return (oppCompany && t.company === oppCompany) || (oppPerson && t.person === oppPerson);
      }
    });

    const relatedPeople = (selectedItem._sheetTab === 'Companies' || activeSubTab === 'Companies') 
      ? people.filter(p => p.company === targetTitle || p.companyname === targetTitle)
      : [];

    let relatedCompany: any = null;
    let relatedOpportunities: any[] = [];

    if (activeTabObj === 'People') {
      const personCompany = selectedItem.company || selectedItem.companyname;
      if (personCompany) {
        relatedCompany = companies.find(c => (c.companyname || c.name)?.toLowerCase() === personCompany.toLowerCase());
      }
      relatedOpportunities = opportunities.filter(o => 
        (o.person && o.person.toLowerCase() === targetTitle.toLowerCase()) || 
        (o.contact && o.contact.toLowerCase() === targetTitle.toLowerCase()) ||
        (personCompany && o.company && o.company.toLowerCase() === personCompany.toLowerCase())
      );
    }

    return (
      <div className="card glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>
            {isEditing && !selectedItem._rowIndex ? `New ${activeSubTab === 'People' ? 'Person' : activeSubTab === 'Companies' ? 'Company' : 'Opportunity'}` : targetTitle}
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

          {!isEditing && relatedCompany && activeTabObj === 'People' && (
            <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', marginBottom: '1rem', color: '#38bdf8' }}>
                <Building2 size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'text-bottom' }}/>
                Related Company: {relatedCompany.companyname || relatedCompany.name}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.95rem' }}>
                <div><span style={{ color: 'var(--text-secondary)' }}>Priority Score:</span> {relatedCompany.priorityscore || relatedCompany.priority || '-'}</div>
                <div><span style={{ color: 'var(--text-secondary)' }}>Work Website:</span> {relatedCompany.workwebsite || relatedCompany.website || '-'}</div>
                <div><span style={{ color: 'var(--text-secondary)' }}>Headcount:</span> {relatedCompany.headcount || relatedCompany.employees || '-'}</div>
                <div><span style={{ color: 'var(--text-secondary)' }}>Turnover:</span> {relatedCompany.turnover || relatedCompany.revenue || '-'}</div>
                <div><span style={{ color: 'var(--text-secondary)' }}>Est. Case Volume:</span> {relatedCompany.estimatedcasevolume || relatedCompany.casevolume || '-'}</div>
              </div>
            </div>
          )}

          {!isEditing && relatedOpportunities.length > 0 && activeTabObj === 'People' && (
            <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', marginBottom: '1rem', color: '#f59e0b' }}>
                <Target size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'text-bottom' }}/>
                Related Opportunities
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {relatedOpportunities.map((opp, idx) => (
                  <div key={idx} style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
                    <div style={{ fontWeight: 500, color: '#fff', marginBottom: '0.5rem' }}>{opp.opportunityname || opp.title || opp.name || `Opportunity ${idx+1}`}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.9rem' }}>
                      <div><span style={{ color: 'var(--text-secondary)' }}>Stage:</span> {opp.stage || '-'}</div>
                      <div><span style={{ color: 'var(--text-secondary)' }}>Value:</span> {opp.value || opp.amount || '-'}</div>
                      <div><span style={{ color: 'var(--text-secondary)' }}>Status:</span> {opp.status || '-'}</div>
                      <div><span style={{ color: 'var(--text-secondary)' }}>Priority:</span> {opp.priority || opp.priorityscore || '-'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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

          {!isEditing && itemTasks.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', marginBottom: '1rem', color: '#10b981' }}>
                <Activity size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'text-bottom' }}/>
                Related Tasks
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {itemTasks.map(t => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.8rem', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
                    <div>
                      <div style={{ color: '#fff', fontWeight: 500 }}>{t.task}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Due: {t.duedate || '-'}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', textAlign: 'right' }}>
                      <span style={{ 
                        padding: '0.2rem 0.6rem', 
                        borderRadius: '12px', 
                        fontSize: '0.75rem', 
                        background: t.status === 'Done' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)',
                        color: t.status === 'Done' ? '#10b981' : '#f59e0b'
                      }}>
                        {t.status || 'Open'}
                      </span>
                      <button 
                        className="btn" 
                        style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', background: 'rgba(255,255,255,0.1)' }}
                        onClick={() => {
                          setActiveSubTab('Tasks');
                          setSelectedItem(t);
                          setEditFormData(t);
                          setIsEditing(true);
                        }}
                      >
                        Edit
                      </button>
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
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={() => {
                if (!isSettingUpMeeting) {
                  setMeetingFormData({
                    date: new Date().toISOString().split('T')[0],
                    startTime: '14:00',
                    endTime: '15:00',
                    type: 'Google Meet',
                    personName: activeSubTab === 'People' ? (selectedItem.name || selectedItem.fullname || selectedItem.contact || '') : (selectedItem.contact || selectedItem.person || ''),
                    personEmail: activeSubTab === 'People' ? (selectedItem.email || selectedItem.workemail || selectedItem.emailaddress || '') : '',
                    companyName: activeSubTab === 'Companies' ? (selectedItem.name || selectedItem.companyname || selectedItem.company || '') : (selectedItem.company || selectedItem.companyname || ''),
                    allowGemini: false
                  });
                  setIsAddingNote(false);
                }
                setIsSettingUpMeeting(!isSettingUpMeeting);
              }}>
                <Calendar size={14} /> Set up Meeting
              </button>
              <button className="btn primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={() => {
                if (!isAddingNote) {
                  setNewActivityData({
                    date: new Date().toISOString().split('T')[0],
                    person: activeSubTab === 'People' ? (selectedItem.name || selectedItem.fullname || selectedItem.contact || '') : (selectedItem.contact || selectedItem.person || ''),
                    company: activeSubTab === 'Companies' ? (selectedItem.name || selectedItem.companyname || selectedItem.company || '') : (selectedItem.company || selectedItem.companyname || ''),
                    notes: ''
                  });
                  setIsSettingUpMeeting(false);
                }
                setIsAddingNote(!isAddingNote);
              }}>
                <Plus size={14} /> Log Activity
              </button>
            </div>
          </div>

          {isSettingUpMeeting && (
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: '#fff' }}>Schedule Meeting</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Date</label>
                  <input type="date" className="input-field" style={{ width: '100%', padding: '0.4rem' }} value={meetingFormData.date} onChange={e => setMeetingFormData({...meetingFormData, date: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Type</label>
                  <select className="input-field" style={{ width: '100%', padding: '0.4rem', marginTop: '0.2rem' }} value={meetingFormData.type} onChange={e => setMeetingFormData({...meetingFormData, type: e.target.value})}>
                    <option>Google Meet</option>
                    <option>In Person</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Start Time</label>
                  <input type="time" className="input-field" style={{ width: '100%', padding: '0.4rem' }} value={meetingFormData.startTime} onChange={e => setMeetingFormData({...meetingFormData, startTime: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>End Time</label>
                  <input type="time" className="input-field" style={{ width: '100%', padding: '0.4rem' }} value={meetingFormData.endTime} onChange={e => setMeetingFormData({...meetingFormData, endTime: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Person</label>
                  <input type="text" className="input-field" style={{ width: '100%', padding: '0.4rem' }} value={meetingFormData.personName} onChange={e => setMeetingFormData({...meetingFormData, personName: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Person Email (For Invite)</label>
                  <input type="email" className="input-field" style={{ width: '100%', padding: '0.4rem' }} value={meetingFormData.personEmail} onChange={e => setMeetingFormData({...meetingFormData, personEmail: e.target.value})} placeholder="email@example.com" />
                </div>
              </div>
              {meetingFormData.type === 'Google Meet' && (
                <div style={{ 
                  marginBottom: '1.5rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '1rem',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{ color: '#a855f7', marginTop: '0.2rem' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.287 1.288L3 12l5.8 1.9a2 2 0 0 1 1.288 1.287L12 21l1.9-5.8a2 2 0 0 1 1.287-1.288L21 12l-5.8-1.9a2 2 0 0 1-1.288-1.287Z"/></svg>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 500, color: '#fff', marginBottom: '0.2rem' }}>Use Gemini to take meeting notes</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Share notes and transcript based on your settings <span style={{ cursor: 'pointer', border: '1px solid var(--text-secondary)', borderRadius: '50%', padding: '0 4px', fontSize: '0.7rem' }}>?</span></div>
                    </div>
                  </div>
                  
                  {/* Custom Toggle Switch */}
                  <div 
                    onClick={() => setMeetingFormData({...meetingFormData, allowGemini: !meetingFormData.allowGemini})}
                    style={{
                      width: '40px',
                      height: '24px',
                      background: meetingFormData.allowGemini ? '#a855f7' : 'rgba(255,255,255,0.2)',
                      borderRadius: '12px',
                      position: 'relative',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                      flexShrink: 0
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      top: '2px',
                      left: meetingFormData.allowGemini ? '18px' : '2px',
                      width: '20px',
                      height: '20px',
                      background: meetingFormData.allowGemini ? '#fff' : '#a0a0a0',
                      borderRadius: '50%',
                      transition: 'left 0.2s, background 0.2s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {!meetingFormData.allowGemini && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#606060" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button className="btn" style={{ background: 'transparent' }} onClick={() => setIsSettingUpMeeting(false)}>Cancel</button>
                <button className="btn primary" onClick={handleCreateMeeting}>Schedule & Invite</button>
              </div>
            </div>
          )}

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
            ) : [...itemActivities].reverse().map(act => (
              <div key={act.id} style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderLeft: `3px solid ${act.type === 'Meeting' ? '#f59e0b' : act.type === 'Conversation' ? '#38bdf8' : '#10b981'}`, borderRadius: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <strong style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#fff', fontSize: '0.9rem' }}>
                    {act.type === 'Note' ? <FileText size={14} /> : act.type === 'Meeting' ? <Calendar size={14} /> : <MessageSquare size={14} />}
                    {act.type}
                  </strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{act.date}</span>
                </div>
                <div style={{ color: '#e2e8f0', fontSize: '0.95rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {act.notes}
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
        <div className="card glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'row', gap: '1rem', alignItems: 'center' }}>
          <button 
            className={`tab ${activeSubTab === 'Tasks' ? 'active' : ''}`}
            onClick={() => { setActiveSubTab('Tasks'); setSelectedItem(null); setIsEditing(false); }}
            style={{ margin: 0, flex: 1, justifyContent: 'center' }}
          >
            <Activity size={16} /> Tasks
          </button>
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
            <Plus size={16} /> New {activeSubTab === 'People' ? 'Person' : activeSubTab === 'Companies' ? 'Company' : activeSubTab === 'Tasks' ? 'Task' : 'Opportunity'}
          </button>
        </div>

        {error && <div style={{ color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px' }}>{error}</div>}
        
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Loading data from Google Sheets...</div>
        ) : (
          <div style={{ overflowY: 'auto', paddingRight: '0.5rem' }}>
            {activeSubTab === 'Tasks' && renderTasks()}
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
