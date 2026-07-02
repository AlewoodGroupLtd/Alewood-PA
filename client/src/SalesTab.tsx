import React, { useState, useEffect } from 'react';
import { Users, Building2, Target, Plus, MessageSquare, Calendar, FileText, Activity, BarChart2, X } from 'lucide-react';

export default function SalesTab() {
  const [activeSubTab, setActiveSubTab] = useState<'Dashboard' | 'Opportunities' | 'People' | 'Companies' | 'Tasks' | 'Meetings' | 'Events'>('Dashboard');
  const [eventsTabView, setEventsTabView] = useState<'list' | 'calendar'>('list');
  const [eventsCalendarDate, setEventsCalendarDate] = useState(new Date());
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [linkingItem, setLinkingItem] = useState<{ type: 'person' | 'company', data: any } | null>(null);
  const [isLinkingEvent, setIsLinkingEvent] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteType, setNoteType] = useState('Note');
  const [newActivityData, setNewActivityData] = useState({ date: '', person: '', company: '', notes: '' });
  const [tempInputs, setTempInputs] = useState<Record<string, string>>({});
  
  // Meeting Scheduler State
  const [isSettingUpMeeting, setIsSettingUpMeeting] = useState(false);
  const [meetingFormData, setMeetingFormData] = useState({ date: '', startTime: '14:00', endTime: '15:00', type: 'Google Meet', personName: '', personEmail: '', companyName: '', allowGemini: false });

  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // CRM Features State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfigs, setSortConfigs] = useState<Record<string, {key: string, direction: 'asc'|'desc'}>>(() => {
    try {
      const saved = localStorage.getItem('crmSortConfigs');
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return {};
  });
  
  // Edit State
  const [sheetHeaders, setSheetHeaders] = useState<Record<string, string[]>>({});
  const [sheetRowCounts, setSheetRowCounts] = useState<Record<string, number>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [dropdownOptions, setDropdownOptions] = useState<Record<string, Record<string, string[]>>>({});
  
  const SPREADSHEET_ID = '1_DvYuIUkKy903wKlRHeR953RsGBLynDu5bhBZ72yCO0';


  const handleLinkToEvent = async (sheetEvent: any) => {
    if (!linkingItem) return;
    setIsLinkingEvent(true);
    try {
      const token = localStorage.getItem('googleAccessToken');
      if (!token) throw new Error("No token");

      const targetRowIndex = sheetEvent._rowIndex;
      if (!targetRowIndex) throw new Error("Event row index not found");
      
      const eventHeaders = sheetHeaders['Events'] || [];
      const updateData = { ...sheetEvent };
      
      if (linkingItem.type === 'person') {
        const newPerson = linkingItem.data.name || linkingItem.data.fullname;
        const currentPeople = updateData.linkedpeople || '';
        if (!currentPeople.includes(newPerson)) {
          updateData.linkedpeople = currentPeople ? `${currentPeople}, ${newPerson}` : newPerson;
        }
      } else {
        const newCompany = linkingItem.data.companyname || linkingItem.data.name;
        const currentCompanies = updateData.linkedcompanies || '';
        if (!currentCompanies.includes(newCompany)) {
          updateData.linkedcompanies = currentCompanies ? `${currentCompanies}, ${newCompany}` : newCompany;
        }
      }

      const rowData = eventHeaders.map(header => {
        if (!header) return '';
        const key = header.toLowerCase().replace(/\s+/g, '');
        return updateData[key] || '';
      });

      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Events!A${targetRowIndex}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: [rowData] })
      });
      if (!res.ok) throw new Error('Failed to update event in CRM');
      
      setEvents(prev => prev.map(e => e._rowIndex === sheetEvent._rowIndex ? updateData : e));
      setLinkingItem(null);
    } catch (err) {
      console.error(err);
      alert('Failed to link CRM event.');
    } finally {
      setIsLinkingEvent(false);
    }
  };

  const loadDataFromSheets = async () => {
    setIsLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('googleAccessToken');
      if (!token) throw new Error("No Google Access Token found. Please re-login.");

      const fetchTab = async (tabName: string, headerIdx: number) => {
        const [res, valRes] = await Promise.all([
          fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${tabName}!A:AZ`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?ranges=${tabName}!A${headerIdx + 2}:AZ${headerIdx + 2}&includeGridData=true`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);
        if (!res.ok) return [];
        const data = await res.json();
        const rows = data.values || [];
        if (rows.length <= headerIdx) return [];
        const headers = rows[headerIdx];
        
        // Save raw headers for exact mapping during edits
        setSheetHeaders(prev => ({ ...prev, [tabName]: headers }));
        setSheetRowCounts(prev => ({ ...prev, [tabName]: rows.length }));

        if (valRes.ok) {
           const valData = await valRes.json();
           const rowValues = valData.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values || [];
           const optionsMap: Record<string, string[]> = {};
           
           const rangePromises: Promise<void>[] = [];
           rowValues.forEach((cell: any, idx: number) => {
             const condition = cell?.dataValidation?.condition;
             if (condition?.type === 'ONE_OF_LIST') {
                const options = condition.values.map((v: any) => v.userEnteredValue);
                const header = headers[idx];
                if (header) {
                  const key = header.toLowerCase().replace(/\s+/g, '');
                  optionsMap[key] = options;
                }
             } else if (condition?.type === 'ONE_OF_RANGE') {
                const rangeStr = condition.values[0]?.userEnteredValue;
                if (rangeStr && rangeStr.startsWith('=')) {
                  const range = rangeStr.substring(1); // remove '='
                  const header = headers[idx];
                  if (header) {
                    const key = header.toLowerCase().replace(/\s+/g, '');
                    const promise = fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`, {
                      headers: { Authorization: `Bearer ${token}` }
                    })
                    .then(r => r.ok ? r.json() : null)
                    .then(rangeData => {
                      if (rangeData && rangeData.values) {
                         optionsMap[key] = rangeData.values.map((row: any[]) => row[0]).filter(Boolean);
                      }
                    })
                    .catch(e => console.error("Failed to fetch range for dropdown", e));
                    rangePromises.push(promise);
                  }
                }
             }
           });
           
           if (rangePromises.length > 0) {
              await Promise.all(rangePromises);
           }
           
           if (Object.keys(optionsMap).length > 0) {
              setDropdownOptions(prev => ({ ...prev, [tabName]: optionsMap }));
           }
        }
        
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

      const [oppsData, peopleData, companiesData, activitiesData, tasksData, eventsData] = await Promise.all([
        fetchTab('Opportunities', 2), // Header in row 3
        fetchTab('People', 2),        // Header in row 3
        fetchTab('Companies', 2),     // Header in row 3
        fetchTab('Activities', 3),    // Header in row 4
        fetchTab('Tasks', 0),         // Header in row 1
        fetchTab('Events', 0)         // Header in row 1
      ]);

      setOpportunities(oppsData);
      setPeople(peopleData);
      setCompanies(companiesData);
      setActivities(activitiesData);
      setTasks(tasksData);
      setEvents(eventsData);
    } catch (e: any) {
      console.error("Failed to load from sheets", e);
      setError(e.message || "Failed to load CRM data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDataFromSheets();

    const handleCRMUpdate = () => {
      loadDataFromSheets();
    };

    window.addEventListener('crm-updated', handleCRMUpdate);
    return () => {
      window.removeEventListener('crm-updated', handleCRMUpdate);
    };
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
        if (!header) return '';
        const key = header.toLowerCase().replace(/\s+/g, '');
        return newActivityObj[key] || '';
      });
      
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Activities!A1:Z1:append?valueInputOption=USER_ENTERED`, {
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
        const errorText = await res.text();
        throw new Error(errorText);
      }
      
      setSheetRowCounts(prev => ({ ...prev, 'Activities': (prev['Activities'] || headers.length) + 1 }));
      
      // Clear after save
      setNewActivityData({ date: '', person: '', company: '', notes: '' });
      
    } catch (e: any) {
      console.error(e);
      alert(`Error saving note to Google Sheets: ${e.message}`);
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
    const finalFormData = { ...editFormData };
    Object.keys(tempInputs).forEach(key => {
      const val = tempInputs[key]?.trim();
      if (val) {
        const currentList = (finalFormData[key] || '').split(',').map((x: string) => x.trim()).filter(Boolean);
        if (!currentList.includes(val)) {
          finalFormData[key] = [...currentList, val].join(', ');
        }
      }
    });

    const rowData = headers.map(header => {
      if (!header) return '';
      const key = header.toLowerCase().replace(/\s+/g, '');
      return finalFormData[key] || '';
    });

    setTempInputs({});

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
      const companyFieldVal = editFormData.company || editFormData.companyname;
      if ((tabName === 'People' || tabName === 'Opportunities') && companyFieldVal) {
        const companyName = companyFieldVal.trim();
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

  const handleDeleteRecord = async () => {
    if (!window.confirm(`Are you sure you want to delete this record?`)) return;

    const token = localStorage.getItem('googleAccessToken');
    if (!token) {
      alert("No Google Access Token. Please login again.");
      return;
    }

    const tabName = selectedItem._sheetTab || activeSubTab;
    const rowIndex = selectedItem._rowIndex;
    if (!rowIndex) return;

    try {
      // Use sheets :clear to empty the row so it gets filtered out without shifting rows or needing sheetId
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${tabName}!A${rowIndex}:Z${rowIndex}:clear`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to delete record (HTTP ${res.status}): ${errorText}`);
      }

      await loadDataFromSheets();
      setIsEditing(false);
      setSelectedItem(null);
    } catch (e: any) {
      console.error(e);
      alert(`Error deleting record from Google Sheets: ${e.message || e}`);
    }
  };

  const handleSort = (key: string, tabOverride?: string) => {
    const targetTab = tabOverride || activeSubTab;
    const currentSort = sortConfigs[targetTab];
    let direction: 'asc'|'desc' = 'asc';
    if (currentSort && currentSort.key === key && currentSort.direction === 'asc') {
      direction = 'desc';
    }
    const newConfigs = { ...sortConfigs, [targetTab]: { key, direction } };
    setSortConfigs(newConfigs);
    try { localStorage.setItem('crmSortConfigs', JSON.stringify(newConfigs)); } catch(e) {}
  };

  const getFilteredAndSortedData = (data: any[], tabName: string) => {
    let filtered = data;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = data.filter(item => 
        Object.values(item).some(val => 
          String(val).toLowerCase().includes(q)
        )
      );
    }

    const currentSort = sortConfigs[tabName];
    if (currentSort) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[currentSort.key] || '';
        const bVal = b[currentSort.key] || '';
        if (aVal < bVal) return currentSort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  };

  const renderSortableHeader = (label: string, sortKey: string, tabOverride?: string) => {
    const targetTab = tabOverride || activeSubTab;
    const currentSort = sortConfigs[targetTab];
    return (
      <th onClick={() => handleSort(sortKey, targetTab)} style={{ cursor: 'pointer', userSelect: 'none' }}>
        {label} {currentSort?.key === sortKey ? (currentSort.direction === 'asc' ? '↑' : '↓') : ''}
      </th>
    );
  };

  const renderMobileSort = (columns: {label: string, key: string}[], tabOverride?: string) => {
    const targetTab = tabOverride || activeSubTab;
    return (
      <select 
        className="mobile-sort-select show-on-mobile" 
        value={sortConfigs[targetTab]?.key || ''} 
        onChange={e => handleSort(e.target.value, targetTab)}
      >
        <option value="">Sort By...</option>
        {columns.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
      </select>
    );
  };

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

  const parseCurrency = (val: string | number) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    return parseFloat(val.replace(/[^0-9.-]+/g, '')) || 0;
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
  };

  const renderDashboard = () => {
    let totalSales = 0;
    const stageCounts: Record<string, number> = {};
    const stageValues: Record<string, number> = {};

    const validOpportunities = opportunities.filter(opp => opp.name || opp.opportunityname || opp.title || opp.company || opp.value);

    validOpportunities.forEach(opp => {
      const val = parseCurrency(opp.value);
      totalSales += val;
      const stage = opp.stage || opp.status || 'Unknown';
      stageCounts[stage] = (stageCounts[stage] || 0) + 1;
      stageValues[stage] = (stageValues[stage] || 0) + val;
    });

    const peopleCount = people.filter(p => p.name || p.fullname || p.company).length;
    const validCompanies = companies.filter(c => c.name || c.companyname);
    const companyCount = validCompanies.length;
    const oppCount = validOpportunities.length;

    const sortedStages = Object.keys(stageCounts).sort((a, b) => stageCounts[b] - stageCounts[a]);
    const maxCount = Math.max(...Object.values(stageCounts), 1);
    const maxValue = Math.max(...Object.values(stageValues), 1);

    // New Data Aggregations
    const validActivities = activities.filter(a => a.notes || a.date || a.person || a.company);
    const recentActivities = [...validActivities].sort((a, b) => {
      const d1 = a.date ? new Date(a.date).getTime() : 0;
      const d2 = b.date ? new Date(b.date).getTime() : 0;
      return d2 - d1;
    }).slice(0, 5);

    const validTasks = tasks.filter(t => (t.task || t.taskname) && t.status !== 'Completed' && t.status !== 'Done');
    const upcomingTasks = [...validTasks].sort((a, b) => {
      const d1 = a.duedate ? new Date(a.duedate).getTime() : 0;
      const d2 = b.duedate ? new Date(b.duedate).getTime() : 0;
      return d1 - d2;
    }).slice(0, 5);

    const getWinPercent = (opp: any) => {
      const wp = opp['win%'] || opp.winpercent || opp.probability || '';
      const num = parseInt(wp.toString().replace(/[^0-9]/g, ''), 10);
      return isNaN(num) ? 50 : Math.min(100, Math.max(0, num));
    };

    const getColorForWinPercent = (percent: number, alpha: number = 1) => {
      return `hsla(${Math.round(percent * 1.2)}, 80%, 50%, ${alpha})`;
    };

    const systemCounts: Record<string, number> = {};
    const systemWinPercents: Record<string, number[]> = {};
    validOpportunities.forEach(opp => {
      let sys = 'Unknown';
      if (opp.company || opp.companyname) {
        const cName = opp.company || opp.companyname;
        const comp = validCompanies.find(c => c.name === cName || c.companyname === cName);
        if (comp && comp.currentsystem) sys = comp.currentsystem;
      }
      systemCounts[sys] = (systemCounts[sys] || 0) + 1;
      if (!systemWinPercents[sys]) systemWinPercents[sys] = [];
      systemWinPercents[sys].push(getWinPercent(opp));
    });
    const sortedSystems = Object.keys(systemCounts).sort((a, b) => systemCounts[b] - systemCounts[a]);
    const maxSystemCount = Math.max(...Object.values(systemCounts), 1);
    const getSystemAvgWin = (sys: string) => {
       const wps = systemWinPercents[sys] || [];
       return wps.length > 0 ? wps.reduce((a,b)=>a+b, 0) / wps.length : 50;
    };

    const priorityCounts: Record<string, number> = {};
    const priorityWinPercents: Record<string, number[]> = {};
    validCompanies.forEach(comp => {
      const prio = comp.priorityscore || comp.priority || 'Unknown';
      priorityCounts[prio] = (priorityCounts[prio] || 0) + 1;
    });
    validOpportunities.forEach(opp => {
      if (opp.company || opp.companyname) {
        const cName = opp.company || opp.companyname;
        const comp = validCompanies.find(c => c.name === cName || c.companyname === cName);
        if (comp) {
           const prio = comp.priorityscore || comp.priority || 'Unknown';
           if (!priorityWinPercents[prio]) priorityWinPercents[prio] = [];
           priorityWinPercents[prio].push(getWinPercent(opp));
        }
      }
    });
    const sortedPriorities = Object.keys(priorityCounts).sort((a, b) => {
      const numA = parseInt(a);
      const numB = parseInt(b);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numB - numA; // highest numbers at the top down to lowest
      }
      if (a === 'Unknown') return 1;
      if (b === 'Unknown') return -1;
      return a.localeCompare(b);
    });
    const maxPriorityCount = Math.max(...Object.values(priorityCounts), 1);
    const getPriorityAvgWin = (prio: string) => {
       const wps = priorityWinPercents[prio] || [];
       return wps.length > 0 ? wps.reduce((a,b)=>a+b, 0) / wps.length : 50;
    };

    // Sales Funnel Data Aggregation
    const definedStages = ['Qualified', 'Follow-up', 'Presentation', 'Contract Sent', 'Negotiation'];
    const funnelData: Record<string, any[]> = {};
    definedStages.forEach(s => funnelData[s] = []);
    
    validOpportunities.forEach(opp => {
      const stage = opp.stage || opp.status;
      if (definedStages.includes(stage)) {
        funnelData[stage].push(opp);
      }
    });

    // Sort opportunities within each stage by value descending
    Object.keys(funnelData).forEach(stage => {
      funnelData[stage].sort((a, b) => parseCurrency(b.value) - parseCurrency(a.value));
    });

    // Combo Chart Data Aggregation (Value & Companies Onboarding)
    const pipelineComboData: Record<string, { value: number; companies: Set<string>; winPercents: number[] }> = {};
    
    validOpportunities.forEach(opp => {
      const dateStr = opp.expectedclosedate || opp.closedate || opp.expectedclose || '';
      let label = 'Unscheduled';
      
      if (dateStr) {
        let d = new Date(dateStr);
        
        // Handle UK DD/MM/YYYY or DD-MM-YYYY formats specifically
        const ukDateMatch = dateStr.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (ukDateMatch) {
          d = new Date(parseInt(ukDateMatch[3], 10), parseInt(ukDateMatch[2], 10) - 1, parseInt(ukDateMatch[1], 10));
        }

        if (!isNaN(d.getTime())) {
          // Format e.g., "15 Jan 2026"
          label = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        } else {
          label = dateStr.trim();
        }
      }
      opp.datelabel = label; // Attach label for search filtering
      
      if (opp.stage !== 'Closed Won' && opp.stage !== 'Closed Lost' && opp.status !== 'Closed Won' && opp.status !== 'Closed Lost') {
        if (!pipelineComboData[label]) {
            pipelineComboData[label] = { value: 0, companies: new Set(), winPercents: [] };
        }
        pipelineComboData[label].value += parseCurrency(opp.value);
        pipelineComboData[label].winPercents.push(getWinPercent(opp));
        if (opp.company || opp.companyname) {
            pipelineComboData[label].companies.add(opp.company || opp.companyname);
        }
      }
    });

    const sortedComboDates = Object.keys(pipelineComboData).sort((a, b) => {
      if (a === 'Unscheduled') return 1;
      if (b === 'Unscheduled') return -1;
      const tA = new Date(a).getTime();
      const tB = new Date(b).getTime();
      if (!isNaN(tA) && !isNaN(tB)) return tA - tB;
      return a.localeCompare(b);
    });

    let cumulativeCompanyCount = 0;
    const finalComboData = sortedComboDates.map(dateLabel => {
       const count = pipelineComboData[dateLabel].companies.size;
       cumulativeCompanyCount += count;
       const wps = pipelineComboData[dateLabel].winPercents;
       const avgWin = wps.length > 0 ? wps.reduce((a,b)=>a+b, 0) / wps.length : 50;
       return {
           label: dateLabel,
           value: pipelineComboData[dateLabel].value,
           cumulativeCompanies: cumulativeCompanyCount,
           avgWinPercent: avgWin
       };
    });

    const maxComboValue = Math.max(...finalComboData.map(d => d.value), 1);
    const maxCumulativeCompanies = Math.max(...finalComboData.map(d => d.cumulativeCompanies), 4);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '2rem' }}>
        <style>{`
          @keyframes slideInUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}</style>
        
        {/* Top Metrics Row */}
        <div className="card glass-panel" style={{ padding: '2rem', position: 'relative', display: 'flex', flexWrap: 'wrap', columnGap: '3rem', rowGap: '1rem', alignItems: 'center' }}>
          
          <div style={{ minWidth: 'min(100%, 200px)' }}>
            <div style={{ color: 'var(--accent)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Total Sales Pipeline</div>
            <div style={{ color: '#fff', fontSize: '3rem', fontWeight: 700, lineHeight: 1 }}>{formatCurrency(totalSales)}</div>
          </div>
          
          <div className="sales-stats-group">
             
             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
               <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>People</div>
               <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                 <div style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--accent)', padding: '0.5rem', borderRadius: '0.5rem', display: 'flex' }}><Users size={20} /></div>
                 <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff', lineHeight: 1 }}>{peopleCount}</div>
               </div>
             </div>

             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '1.5rem' }}>
               <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Companies</div>
               <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                 <div style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--accent)', padding: '0.5rem', borderRadius: '0.5rem', display: 'flex' }}><Building2 size={20} /></div>
                 <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff', lineHeight: 1 }}>{companyCount}</div>
               </div>
             </div>

             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '1.5rem' }}>
               <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Opportunities</div>
               <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                 <div style={{ color: 'var(--accent)', fontSize: '1.5rem', fontWeight: 700, padding: '0 0.25rem' }}>$</div>
                 <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff', lineHeight: 1 }}>{oppCount}</div>
               </div>
             </div>
          </div>
          
        </div>

        {/* Funnel and Pipeline Row */}
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          
          {/* Sales Funnel Chart */}
          <div className="card glass-panel" style={{ flex: 1, minWidth: 'min(100%, 400px)', padding: '2rem' }}>
            <div style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: '2rem', fontSize: '0.9rem', letterSpacing: '0.05em', textAlign: 'center' }}>OPPORTUNITY SALES FUNNEL</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              {definedStages.map((stage, index) => {
              const opps = funnelData[stage] || [];
              const widthPercent = 100 - (index * 12); // 100, 88, 76, 64, 52
              const opacity = 1 - (index * 0.15); // 1, 0.85, 0.7, 0.55, 0.4
              
              return (
                <div key={stage} style={{ 
                  width: `${widthPercent}%`, 
                  background: `linear-gradient(90deg, rgba(56, 189, 248, ${opacity}) 0%, rgba(59, 130, 246, ${opacity}) 100%)`, 
                  borderRadius: '12px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  minHeight: '80px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                  position: 'relative',
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.1)',
                  animation: `slideInUp 0.6s ease-out ${index * 0.1}s both`
                }}>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem', marginBottom: '1rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {stage} ({opps.length}) - {formatCurrency(opps.reduce((sum, o) => sum + parseCurrency(o.value), 0))}
                  </div>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
                    {opps.length === 0 ? (
                      <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>No active opportunities</span>
                    ) : opps.map((opp, i) => (
                      <div key={i} style={{ 
                        background: getColorForWinPercent(getWinPercent(opp), 0.6), 
                        padding: '0.5rem 1rem', 
                        borderRadius: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        backdropFilter: 'blur(4px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        transition: 'transform 0.2s',
                        cursor: 'pointer'
                      }}
                      onClick={() => { setSelectedItem(opp); setActiveSubTab('Opportunities'); }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 500 }}>{opp.company || opp.companyname || 'Unknown'}</span>
                        <span style={{ color: 'var(--success)', fontSize: '0.85rem', fontWeight: 700 }}>{formatCurrency(parseCurrency(opp.value))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* Pipeline Forecast Combo Chart */}
        <div className="card glass-panel" style={{ flex: 1, minWidth: 'min(100%, 400px)', padding: '2rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: '2rem', fontSize: '0.9rem', letterSpacing: '0.05em', textAlign: 'center' }}>PIPELINE: VALUE & ONBOARDING</div>
          
          {finalComboData.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No active forecast data</div>
          ) : (
            <div style={{ display: 'flex', flex: 1, position: 'relative', minHeight: '400px' }}>
              
              {/* Chart Area */}
              <div style={{ position: 'absolute', left: '3rem', right: '4.5rem', top: '1rem', bottom: '9rem' }}>
                
                {/* Horizontal Grid Lines */}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', zIndex: 0 }}>
                  {[4, 3, 2, 1, 0].map(i => (
                     <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', width: '100%', height: 0 }}></div>
                  ))}
                </div>

                {/* Left Y-Axis Labels (Companies) */}
                <div style={{ position: 'absolute', left: '-3rem', top: 0, bottom: 0, width: '2.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', zIndex: 0 }}>
                  {[4, 3, 2, 1, 0].map(i => {
                     const countVal = Math.round((maxCumulativeCompanies / 4) * i);
                     return <div key={i} style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '-0.5rem' }}>{countVal}</div>
                  })}
                  <div style={{ position: 'absolute', top: '50%', left: '-2rem', transform: 'translateY(-50%) rotate(-90deg)', fontSize: '0.7rem', color: 'var(--text-secondary)', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>CUSTOMERS</div>
                </div>

                {/* Right Y-Axis Labels (Value) */}
                <div style={{ position: 'absolute', right: '-4.5rem', top: 0, bottom: 0, width: '4rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', zIndex: 0 }}>
                  {[4, 3, 2, 1, 0].map(i => {
                     const val = (maxComboValue / 4) * i;
                     return <div key={i} style={{ textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '-0.5rem', paddingLeft: '0.5rem' }}>{val >= 1000 ? `$${(val/1000).toFixed(0)}k` : `$${val.toFixed(0)}`}</div>
                  })}
                  <div style={{ position: 'absolute', top: '50%', right: '-1rem', transform: 'translateY(-50%) rotate(90deg)', fontSize: '0.7rem', color: 'var(--text-secondary)', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>VALUE</div>
                </div>

                {/* X-Axis Data Bars */}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', zIndex: 1 }}>
                  {finalComboData.map((d, idx) => {
                    const heightPercent = (d.value / maxComboValue) * 100;
                    return (
                      <div key={d.label} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', height: '100%', justifyContent: 'flex-end' }}>
                        
                        {/* Interactive Tooltip Area */}
                        <div style={{ position: 'absolute', inset: 0, zIndex: 3, cursor: 'pointer' }} 
                             title={`${d.label}\nValue: $${formatCurrency(d.value)}\nTotal Companies Onboarded: ${d.cumulativeCompanies}`}
                             onClick={() => { setSearchQuery(d.label); setActiveSubTab('Opportunities'); }}
                        ></div>
                        
                        {/* Bar */}
                        <div style={{ 
                          width: '12px', 
                          height: `calc(${heightPercent}%)`,
                          background: getColorForWinPercent(d.avgWinPercent, 0.9), 
                          borderRadius: '4px 4px 0 0',
                          minHeight: '4px',
                          boxShadow: '0 0 10px rgba(0,0,0,0.2)',
                          animation: `slideInUp 0.6s ease-out ${idx * 0.1}s both`
                        }}></div>
                        
                        {/* X-Axis Label */}
                        <div style={{ position: 'absolute', top: 'calc(100% + 0.5rem)', right: '50%', fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', transform: 'rotate(-45deg)', transformOrigin: 'top right' }}>{d.label}</div>
                      </div>
                    )
                  })}
                </div>

                {/* SVG Line Overlay */}
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none', overflow: 'visible' }}>
                  <polyline 
                    points={finalComboData.map((d, idx) => {
                      const x = (idx + 0.5) * (100 / finalComboData.length);
                      const y = 100 - (d.cumulativeCompanies / maxCumulativeCompanies) * 100;
                      return `${x},${y}`;
                    }).join(' ')}
                    fill="none" 
                    stroke="#A3A3A3" 
                    strokeWidth="3" 
                    strokeLinejoin="round" 
                    vectorEffect="non-scaling-stroke"
                    style={{ animation: 'fadeIn 1s ease-out both' }}
                  />
                  {finalComboData.map((d, idx) => {
                    const x = (idx + 0.5) * (100 / finalComboData.length);
                    const y = 100 - (d.cumulativeCompanies / maxCumulativeCompanies) * 100;
                    return <circle key={idx} cx={x} cy={y} r="4" fill="#fff" stroke="#A3A3A3" strokeWidth="2" vectorEffect="non-scaling-stroke" style={{ animation: 'fadeIn 1s ease-out both' }} />
                  })}
                </svg>

              </div>
            </div>
          )}
        </div>
      </div>

      {/* Existing Charts Area (Stage Count & Value) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* We will leave the Stage charts exactly as they are down below, but we move System & Priority up here */}
        </div>

        {/* New Row: System and Priority Charts */}
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          {/* Opportunities by System */}
          <div className="card glass-panel" style={{ flex: 1, minWidth: 'min(100%, 400px)', padding: '2rem' }}>
            <div style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: '2rem', fontSize: '0.9rem', letterSpacing: '0.05em' }}>OPPORTUNITIES BY CURRENT SYSTEM</div>
            <div style={{ position: 'relative', paddingLeft: '7rem', paddingBottom: '2rem', paddingRight: '2rem' }}>
              <div style={{ position: 'absolute', top: 0, bottom: '2rem', left: '7rem', right: '2rem', display: 'flex', justifyContent: 'space-between' }}>
                {[0, 1, 2, 3, 4].map(i => <div key={i} style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', height: '100%' }}></div>)}
              </div>
              {sortedSystems.map(sys => (
                <div key={sys} style={{ position: 'relative', display: 'flex', alignItems: 'center', height: '2rem', marginBottom: '1rem', zIndex: 1, cursor: 'pointer' }}
                     onClick={() => { setSearchQuery(sys); setActiveSubTab('Companies'); }}
                >
                   <div style={{ width: '6.5rem', position: 'absolute', left: '-7rem', textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{sys}</div>
                   <div style={{ background: getColorForWinPercent(getSystemAvgWin(sys), 0.9), height: '100%', width: `${(systemCounts[sys] / maxSystemCount) * 100}%`, borderRadius: '0 4px 4px 0', minWidth: '4px' }}></div>
                   <div style={{ marginLeft: '1rem', fontSize: '0.85rem', color: '#fff', whiteSpace: 'nowrap' }}>{systemCounts[sys]}</div>
                </div>
              ))}
              <div style={{ position: 'absolute', bottom: 0, left: '7rem', right: '2rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '0.5rem' }}>
                {[0, 1, 2, 3, 4].map(i => <span key={i} style={{ transform: 'translateX(-50%)' }}>{Math.round((maxSystemCount / 4) * i)}</span>)}
              </div>
            </div>
          </div>

          {/* Company Priority Matrix */}
          <div className="card glass-panel" style={{ flex: 1, minWidth: 'min(100%, 400px)', padding: '2rem' }}>
            <div style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: '2rem', fontSize: '0.9rem', letterSpacing: '0.05em' }}>COMPANY PRIORITY MATRIX</div>
            <div style={{ position: 'relative', paddingLeft: '7rem', paddingBottom: '2rem', paddingRight: '2rem' }}>
              <div style={{ position: 'absolute', top: 0, bottom: '2rem', left: '7rem', right: '2rem', display: 'flex', justifyContent: 'space-between' }}>
                {[0, 1, 2, 3, 4].map(i => <div key={i} style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', height: '100%' }}></div>)}
              </div>
              {sortedPriorities.map(prio => (
                <div key={prio} style={{ position: 'relative', display: 'flex', alignItems: 'center', height: '2rem', marginBottom: '1rem', zIndex: 1, cursor: 'pointer' }}
                     onClick={() => { setSearchQuery(prio); setActiveSubTab('Companies'); }}
                >
                   <div style={{ width: '6.5rem', position: 'absolute', left: '-7rem', textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{prio}</div>
                   <div style={{ background: getColorForWinPercent(getPriorityAvgWin(prio), 0.9), height: '100%', width: `${(priorityCounts[prio] / maxPriorityCount) * 100}%`, borderRadius: '0 4px 4px 0', minWidth: '4px' }}></div>
                   <div style={{ marginLeft: '1rem', fontSize: '0.85rem', color: '#fff', whiteSpace: 'nowrap' }}>{priorityCounts[prio]}</div>
                </div>
              ))}
              <div style={{ position: 'absolute', bottom: 0, left: '7rem', right: '2rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '0.5rem' }}>
                {[0, 1, 2, 3, 4].map(i => <span key={i} style={{ transform: 'translateX(-50%)' }}>{Math.round((maxPriorityCount / 4) * i)}</span>)}
              </div>
            </div>
          </div>
        </div>

        {/* New Row: Tasks and Activities Lists */}
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          {/* Tasks Due Soon */}
          <div className="card glass-panel" style={{ flex: 1, minWidth: 'min(100%, 350px)', padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent)', fontWeight: 600, marginBottom: '1.5rem', fontSize: '0.9rem', letterSpacing: '0.05em' }}>
              <Calendar size={18} />
              <span>TASKS DUE SOON</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {upcomingTasks.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No pending tasks.</div>
              ) : upcomingTasks.map((task, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '1rem', borderBottom: i === upcomingTasks.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ color: '#fff', fontWeight: 500, fontSize: '0.95rem' }}>{task.task || task.taskname}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{task.person || task.company || 'General'}</span>
                  </div>
                  <span style={{ color: 'var(--accent)', fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                    {task.duedate || 'No date'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="card glass-panel" style={{ flex: 1, minWidth: 'min(100%, 350px)', padding: '2rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent)', fontWeight: 600, marginBottom: '1.5rem', fontSize: '0.9rem', letterSpacing: '0.05em' }}>
              <Activity size={18} />
              <span>RECENT ACTIVITY</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', maxHeight: '350px', paddingRight: '0.5rem' }}>
              {recentActivities.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No recent activity.</div>
              ) : recentActivities.map((act, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 600 }}>{act.person || act.company || 'Update'}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{act.date || 'Unknown'}</span>
                  </div>
                  <div style={{ color: '#fff', fontSize: '0.85rem', lineHeight: 1.5, maxHeight: '80px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                    {act.notes || 'Activity recorded'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Existing Charts Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Chart 1: Count */}
          <div className="card glass-panel" style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', padding: '2rem' }}>
            <div style={{ flex: 2, minWidth: 'min(100%, 400px)' }}>
              <div style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: '2rem', fontSize: '0.9rem', letterSpacing: '0.05em' }}>NUMBER OF OPPORTUNITIES BY STAGE</div>
              <div style={{ position: 'relative', paddingLeft: '7rem', paddingBottom: '2rem', paddingRight: '6rem' }}>
                {/* Grid lines */}
                <div style={{ position: 'absolute', top: 0, bottom: '2rem', left: '7rem', right: '6rem', display: 'flex', justifyContent: 'space-between' }}>
                  {[0, 1, 2, 3, 4].map(i => (
                     <div key={i} style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', height: '100%' }}></div>
                  ))}
                </div>
                {/* Bars */}
                {sortedStages.map(stage => (
                  <div key={stage} style={{ position: 'relative', display: 'flex', alignItems: 'center', height: '2.5rem', marginBottom: '1.5rem', zIndex: 1 }}>
                     <div style={{ width: '6.5rem', position: 'absolute', left: '-7rem', textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Count</div>
                     <div style={{ background: 'var(--accent)', height: '100%', width: `${(stageCounts[stage] / maxCount) * 100}%`, borderRadius: '0 4px 4px 0', minWidth: '4px' }}></div>
                     <div style={{ marginLeft: '1rem', fontSize: '0.85rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
                       <div style={{ width: '8px', height: '8px', background: 'var(--accent)', borderRadius: '50%' }}></div>
                       {stage}
                     </div>
                  </div>
                ))}
                {/* X Axis labels */}
                <div style={{ position: 'absolute', bottom: 0, left: '7rem', right: '6rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '0.5rem' }}>
                  {[0, 1, 2, 3, 4].map(i => <span key={i} style={{ transform: 'translateX(-50%)' }}>{Math.round((maxCount / 4) * i)}</span>)}
                </div>
              </div>
            </div>
            
            <div style={{ flex: 1, minWidth: 'min(100%, 250px)', padding: '0 1rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '0.5rem', marginBottom: '0.5rem', color: '#fff' }}>
                <span>Stage</span>
                <span>Count</span>
              </div>
              {sortedStages.map(stage => (
                <div key={stage} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <span>{stage}</span>
                  <span style={{ color: '#fff', fontWeight: 500 }}>{stageCounts[stage]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chart 2: Value */}
          <div className="card glass-panel" style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', padding: '2rem' }}>
            <div style={{ flex: 2, minWidth: 'min(100%, 400px)' }}>
              <div style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: '2rem', fontSize: '0.9rem', letterSpacing: '0.05em' }}>VALUE OF OPPORTUNITIES BY STAGE</div>
              <div style={{ position: 'relative', paddingLeft: '7rem', paddingBottom: '2rem', paddingRight: '8rem' }}>
                {/* Grid lines */}
                <div style={{ position: 'absolute', top: 0, bottom: '2rem', left: '7rem', right: '8rem', display: 'flex', justifyContent: 'space-between' }}>
                  {[0, 1, 2, 3, 4].map(i => (
                     <div key={i} style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', height: '100%' }}></div>
                  ))}
                </div>
                {/* Bars */}
                {sortedStages.map(stage => (
                  <div key={stage} style={{ position: 'relative', display: 'flex', alignItems: 'center', height: '2.5rem', marginBottom: '1.5rem', zIndex: 1 }}>
                     <div style={{ width: '6.5rem', position: 'absolute', left: '-7rem', textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Value</div>
                     <div style={{ background: 'var(--accent)', height: '100%', width: `${(stageValues[stage] / maxValue) * 100}%`, borderRadius: '0 4px 4px 0', minWidth: '4px' }}></div>
                     <div style={{ marginLeft: '1rem', fontSize: '0.85rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
                       <div style={{ width: '8px', height: '8px', background: 'var(--accent)', borderRadius: '50%' }}></div>
                       {stage}
                     </div>
                  </div>
                ))}
                {/* X Axis labels */}
                <div style={{ position: 'absolute', bottom: 0, left: '7rem', right: '8rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '0.5rem' }}>
                  {[0, 1, 2, 3, 4].map(i => <span key={i} style={{ transform: 'translateX(-50%)' }}>{formatCurrency((maxValue / 4) * i)}</span>)}
                </div>
              </div>
            </div>
            
            <div style={{ flex: 1, minWidth: 'min(100%, 250px)', padding: '0 1rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '0.5rem', marginBottom: '0.5rem', color: '#fff' }}>
                <span>Stage</span>
                <span>Total value</span>
              </div>
              {sortedStages.map(stage => (
                <div key={stage} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <span>{stage}</span>
                  <span style={{ color: '#fff', fontWeight: 500 }}>{formatCurrency(stageValues[stage])}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    );
  };

  const renderOpportunities = () => {
    const data = getFilteredAndSortedData(opportunities, 'Opportunities');
    return (
      <div style={{ overflowX: 'auto' }}>
        {renderMobileSort([
          { label: 'Company', key: 'company' },
          { label: 'Name', key: 'name' },
          { label: 'Value', key: 'value' },
          { label: 'Win %', key: 'win%' },
          { label: 'Close Date', key: 'closedate' },
          { label: 'Priority', key: 'priority' },
          { label: 'Status', key: 'status' }
        ], 'Opportunities')}
        <table className="mobile-card-list" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              {renderSortableHeader('Company', 'company')}
              {renderSortableHeader('Name', 'name')}
              {renderSortableHeader('Value', 'value')}
              {renderSortableHeader('Win %', 'win%')}
              {renderSortableHeader('Close Date', 'closedate')}
              {renderSortableHeader('Priority', 'priority')}
              {renderSortableHeader('Status', 'status')}
            </tr>
          </thead>
          <tbody>
            {data.map(opp => (
              <tr key={opp.id} onClick={() => setSelectedItem(opp)} style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="table-row-hover">
                <td data-label="Company" style={{ padding: '0.8rem 0' }}>{opp.company || opp.companyname}</td>
                <td data-label="Name">{opp.name || opp.opportunityname || opp.title}</td>
                <td data-label="Value" style={{ color: '#10b981' }}>{opp.value || opp.amount}</td>
                <td data-label="Win %">{opp['win%'] || opp.winpercent || opp.probability}</td>
                <td data-label="Close Date">{opp.closedate || opp.expectedclosedate || opp.expectedclose}</td>
                <td data-label="Priority">{renderColoredValue('priority', opp.priority || opp.priorityscore)}</td>
                <td data-label="Status">{renderColoredValue('status', opp.status || opp.stage)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderPeople = () => {
    const data = getFilteredAndSortedData(people, 'People');
    return (
      <div style={{ overflowX: 'auto' }}>
        {renderMobileSort([
          { label: 'Name', key: 'name' },
          { label: 'Company', key: 'company' },
          { label: 'Title', key: 'title' },
          { label: 'Website', key: 'workwebsite' },
          { label: 'LinkedIn', key: 'linkedin' }
        ], 'People')}
        <table className="mobile-card-list" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              {renderSortableHeader('Name', 'name')}
              {renderSortableHeader('Company', 'company')}
              {renderSortableHeader('Title', 'title')}
              {renderSortableHeader('Website', 'workwebsite')}
              {renderSortableHeader('LinkedIn', 'linkedin')}
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {data.map(person => (
              <tr key={person.id} onClick={() => setSelectedItem(person)} style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="table-row-hover">
                <td data-label="Name" style={{ padding: '0.8rem 0' }}>{person.name || person.fullname}</td>
                <td data-label="Company">{person.company}</td>
                <td data-label="Title" style={{ color: 'var(--text-secondary)' }}>{person.title || person.role}</td>
                <td data-label="Website"><a href={person.workwebsite?.startsWith('http') ? person.workwebsite : `https://${person.workwebsite}`} target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }} onClick={e => e.stopPropagation()}>{person.workwebsite}</a></td>
                <td data-label="LinkedIn"><a href={person.linkedin?.startsWith('http') ? person.linkedin : `https://${person.linkedin}`} target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }} onClick={e => e.stopPropagation()}>{person.linkedin ? 'Profile' : ''}</a></td>
                <td data-label="Action" onClick={e => e.stopPropagation()}>
                  <button 
                    className="icon-btn" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setLinkingItem({ type: 'person', data: person });
                    }}
                    title="Link Event"
                    style={{ padding: '0.4rem', background: 'rgba(255,255,255,0.1)', borderRadius: '0.25rem' }}
                  >
                    <Calendar size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderCompanies = () => {
    const data = getFilteredAndSortedData(companies, 'Companies');
    return (
      <div style={{ overflowX: 'auto' }}>
        {renderMobileSort([
          { label: 'Company Name', key: 'companyname' },
          { label: 'Contact Type', key: 'contacttype' },
          { label: 'Type', key: 'type' },
          { label: 'System', key: 'currentsystem' },
          { label: 'Priority', key: 'priorityscore' },
          { label: 'Website', key: 'workwebsite' },
          { label: 'Headcount', key: 'headcount' },
          { label: 'Turnover', key: 'turnover' },
          { label: 'Est Case Vol', key: 'estimatedcasevolume' }
        ], 'Companies')}
        <table className="mobile-card-list" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
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
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {data.map(company => (
              <tr key={company.id} onClick={() => setSelectedItem(company)} style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="table-row-hover">
                <td data-label="Company Name" style={{ padding: '0.8rem 0' }}>{company.companyname || company.name}</td>
                <td data-label="Contact Type">{company.contacttype}</td>
                <td data-label="Type">{company.type}</td>
                <td data-label="System">{company.currentsystem}</td>
                <td data-label="Priority">{renderColoredValue('priorityscore', company.priorityscore)}</td>
                <td data-label="Website"><a href={company.workwebsite?.startsWith('http') ? company.workwebsite : `https://${company.workwebsite}`} target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }} onClick={e => e.stopPropagation()}>{company.workwebsite}</a></td>
                <td data-label="Headcount">{company.headcount}</td>
                <td data-label="Turnover">{company.turnover}</td>
                <td data-label="Est Case Vol">{company.estimatedcasevolume}</td>
                <td data-label="Action" onClick={e => e.stopPropagation()}>
                  <button 
                    className="icon-btn" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setLinkingItem({ type: 'company', data: company });
                    }}
                    title="Link Event"
                    style={{ padding: '0.4rem', background: 'rgba(255,255,255,0.1)', borderRadius: '0.25rem' }}
                  >
                    <Calendar size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderTasks = () => {
    const data = getFilteredAndSortedData(tasks, 'Tasks');
    return (
      <div style={{ overflowX: 'auto' }}>
        {renderMobileSort([
          { label: 'Date', key: 'date' },
          { label: 'Person', key: 'person' },
          { label: 'Company', key: 'company' },
          { label: 'Due Date', key: 'duedate' },
          { label: 'Task', key: 'task' },
          { label: 'Status', key: 'status' }
        ], 'Tasks')}
        <table className="mobile-card-list" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
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
                <td data-label="Date" style={{ padding: '0.8rem 0', whiteSpace: 'nowrap' }}>{t.date}</td>
                <td data-label="Person">{t.person}</td>
                <td data-label="Company">{t.company}</td>
                <td data-label="Due Date" style={{ whiteSpace: 'nowrap' }}>{t.duedate}</td>
                <td data-label="Task" style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '300px' }}>{t.task}</td>
                <td data-label="Status">{renderColoredValue('status', t.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderMeetings = () => {
    // Filter activities that are "Meeting" type
    const meetingActivities = activities.filter(a => a.type?.toLowerCase().includes('meeting') || a.type?.toLowerCase().includes('call'));
    // Sort by date descending
    meetingActivities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div className="card glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <Calendar size={24} color="var(--accent)" />
            <span style={{ fontSize: '1.2rem', color: '#fff', fontWeight: 600 }}>Meeting Recordings</span>
          </div>
          <p style={{ color: 'var(--text-secondary)' }}>Use the floating Record button in the bottom left corner to capture a meeting.</p>
          <p style={{ color: 'var(--text-secondary)' }}>Audio and transcripts are saved directly to your Google Drive.</p>
          <a 
            href="https://drive.google.com/drive/search?q=name%3D'Meet%20Recordings'" 
            target="_blank" 
            rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', padding: '0.75rem 1.5rem', background: 'var(--accent)', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, transition: 'transform 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            Open Meet Recordings Folder
          </a>
        </div>

        <div className="card glass-panel" style={{ padding: '2rem' }}>
          <div style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: '1.5rem', fontSize: '0.9rem', letterSpacing: '0.05em' }}>RECENT MEETINGS & CALLS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {meetingActivities.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)' }}>No meetings recorded yet.</div>
            ) : meetingActivities.map((meeting, i) => (
              <div key={meeting.id || i} style={{ 
                background: 'rgba(255,255,255,0.03)', 
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: '8px', 
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ background: 'var(--accent)', color: '#fff', padding: '0.5rem 1rem', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600 }}>
                      {meeting.date || 'Unknown Date'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: '#fff', fontWeight: 600, fontSize: '1.1rem' }}>{meeting.company || meeting.person || 'General Meeting'}</span>
                      {meeting.company && meeting.person && (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>with {meeting.person}</span>
                      )}
                    </div>
                  </div>
                </div>
                
                {meeting.notes && (
                  <div style={{ 
                    background: 'rgba(0,0,0,0.2)', 
                    padding: '1rem', 
                    borderRadius: '4px', 
                    color: '#e2e8f0', 
                    fontSize: '0.95rem', 
                    lineHeight: 1.6, 
                    whiteSpace: 'pre-wrap',
                    maxHeight: '300px',
                    overflowY: 'auto'
                  }}>
                    {meeting.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderEventsCalendarView = (data: any[]) => {
    const year = eventsCalendarDate.getFullYear();
    const month = eventsCalendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return (
      <div style={{ marginTop: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, color: '#fff' }}>{eventsCalendarDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="icon-btn" style={{ background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', color: '#fff' }} onClick={() => setEventsCalendarDate(new Date(year, month - 1, 1))}>&lt;</button>
            <button className="icon-btn" style={{ background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', color: '#fff' }} onClick={() => setEventsCalendarDate(new Date())}>Today</button>
            <button className="icon-btn" style={{ background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', color: '#fff' }} onClick={() => setEventsCalendarDate(new Date(year, month + 1, 1))}>&gt;</button>
          </div>
        </div>

        <div className="grid-7" style={{ gap: '0.5rem' }}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', padding: '0.5rem 0' }}>{d}</div>
          ))}
          {days.map((d, i) => {
            if (!d) return <div key={i} style={{ background: 'transparent' }} />;
            const isToday = d.toLocaleDateString('en-GB') === new Date().toLocaleDateString('en-GB');
            const dateStr = d.toLocaleDateString('en-GB');
            
            const dayEvents = data.filter(evt => {
              if (!evt.date) return false;
              let evtDate = new Date(evt.date);
              const ukDateMatch = evt.date.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
              if (ukDateMatch) {
                evtDate = new Date(parseInt(ukDateMatch[3], 10), parseInt(ukDateMatch[2], 10) - 1, parseInt(ukDateMatch[1], 10));
              }
              return !isNaN(evtDate.getTime()) && evtDate.toLocaleDateString('en-GB') === dateStr;
            });

            return (
              <div key={i} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '0.5rem', padding: '0.5rem', minHeight: '80px', border: isToday ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.85rem', textAlign: 'right', color: isToday ? '#38bdf8' : 'var(--text-secondary)', fontWeight: isToday ? 600 : 400, marginBottom: '0.5rem' }}>{d.getDate()}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {dayEvents.slice(0, 3).map((evt: any, idx: number) => (
                    <div key={evt.id || idx} onClick={() => setSelectedItem(evt)} style={{ background: 'rgba(56, 189, 248, 0.2)', fontSize: '0.75rem', padding: '4px 6px', borderRadius: '4px', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer', borderLeft: '2px solid #38bdf8' }} title={evt.eventname || evt.name || evt.title}>
                      {evt.eventname || evt.name || evt.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '2px' }}>+{dayEvents.length - 3} more</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderEvents = () => {
    const data = getFilteredAndSortedData(events, 'Events');

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem', padding: '0.25rem', width: 'fit-content', marginLeft: 'auto' }}>
          <button 
            className="icon-btn" 
            style={{ padding: '0.25rem 1rem', background: eventsTabView === 'list' ? 'rgba(255,255,255,0.1)' : 'transparent', borderRadius: '0.25rem', color: eventsTabView === 'list' ? '#fff' : 'var(--text-secondary)', fontWeight: 600, border: 'none', cursor: 'pointer' }}
            onClick={() => setEventsTabView('list')} title="List View"
          >
            List
          </button>
          <button 
            className="icon-btn" 
            style={{ padding: '0.25rem 1rem', background: eventsTabView === 'calendar' ? 'rgba(255,255,255,0.1)' : 'transparent', borderRadius: '0.25rem', color: eventsTabView === 'calendar' ? '#fff' : 'var(--text-secondary)', fontWeight: 600, border: 'none', cursor: 'pointer', marginLeft: '0.25rem' }}
            onClick={() => setEventsTabView('calendar')} title="Calendar View"
          >
            Calendar
          </button>
        </div>

        {eventsTabView === 'list' ? (
          <div style={{ overflowX: 'auto' }}>
            {renderMobileSort([
              { label: 'Date', key: 'date' },
              { label: 'Event Name', key: 'eventname' },
              { label: 'Type', key: 'type' },
              { label: 'Location', key: 'location' },
              { label: 'Linked Companies', key: 'linkedcompanies' },
              { label: 'Linked People', key: 'linkedpeople' },
              { label: 'Status', key: 'status' }
            ], 'Events')}
            <table className="mobile-card-list" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)' }}>
                  {renderSortableHeader('Date', 'date')}
                  {renderSortableHeader('Event Name', 'eventname')}
                  {renderSortableHeader('Type', 'type')}
                  {renderSortableHeader('Location', 'location')}
                  {renderSortableHeader('Linked Companies', 'linkedcompanies')}
                  {renderSortableHeader('Linked People', 'linkedpeople')}
                  {renderSortableHeader('Status', 'status')}
                </tr>
              </thead>
              <tbody>
                {data.map((evt, i) => (
                  <tr key={evt.id || i} 
                      style={{ borderBottom: '1px dashed rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'background 0.2s', background: selectedItem?.id === evt.id ? 'rgba(56, 189, 248, 0.1)' : 'transparent' }}
                      onClick={() => setSelectedItem(evt)}
                      onMouseEnter={e => e.currentTarget.style.background = selectedItem?.id === evt.id ? 'rgba(56, 189, 248, 0.1)' : 'rgba(255,255,255,0.02)'}
                      onMouseLeave={e => e.currentTarget.style.background = selectedItem?.id === evt.id ? 'rgba(56, 189, 248, 0.1)' : 'transparent'}
                  >
                    <td data-label="Date" style={{ padding: '0.8rem 0' }}>{evt.date}</td>
                    <td data-label="Event Name" style={{ fontWeight: 500, color: '#fff' }}>{evt.eventname || evt.name || evt.title}</td>
                    <td data-label="Type">{renderColoredValue('type', evt.type)}</td>
                    <td data-label="Location">{evt.location}</td>
                    <td data-label="Linked Companies" style={{ color: 'var(--accent)' }}>{evt.linkedcompanies || evt.company}</td>
                    <td data-label="Linked People">{evt.linkedpeople || evt.person}</td>
                    <td data-label="Status">{renderColoredValue('status', evt.status)}</td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No events found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card glass-panel" style={{ padding: '2rem' }}>
             {renderEventsCalendarView(data)}
          </div>
        )}
      </div>
    );
  };

  const getDropdownOptionsFallback = (tabName: string, key: string) => {
    if (dropdownOptions[tabName] && dropdownOptions[tabName][key]) {
      return dropdownOptions[tabName][key];
    }
    
    // Fallback: extract unique values from loaded data for known dropdown columns
    const knownDropdowns = ['stage', 'status', 'lossreason', 'source', 'type', 'contacttype'];
    if (knownDropdowns.includes(key)) {
      let data: any[] = [];
      if (tabName === 'Opportunities') data = opportunities;
      else if (tabName === 'People') data = people;
      else if (tabName === 'Companies') data = companies;
      else if (tabName === 'Tasks') data = tasks;
      
      const unique = Array.from(new Set(data.map(item => item[key]).filter(Boolean))) as string[];
      return unique.sort();
    }
    return null;
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
      const matchText = (val1: string, val2: string) => val1 && val2 && val1.toString().trim().toLowerCase() === val2.toString().trim().toLowerCase();
      if (activeSubTab === 'People') {
        return matchText(a.person, targetTitle);
      } else if (activeSubTab === 'Companies') {
        return matchText(a.company, targetTitle);
      } else {
        // Opportunities
        const oppCompany = selectedItem.company || selectedItem.companyname;
        const oppPerson = selectedItem.contact || selectedItem.person;
        return matchText(a.company, oppCompany) || matchText(a.person, oppPerson);
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
    let relatedEvents: any[] = [];

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

    if (activeTabObj === 'People' || activeTabObj === 'Companies') {
      relatedEvents = events.filter(e => {
        if (activeTabObj === 'People' && e.linkedpeople && e.linkedpeople.toLowerCase().includes(targetTitle.toLowerCase())) return true;
        if (activeTabObj === 'Companies' && e.linkedcompanies && e.linkedcompanies.toLowerCase().includes(targetTitle.toLowerCase())) return true;
        return false;
      }).filter(e => {
        if (!e.date) return true;
        let evtDate = new Date(e.date);
        const ukDateMatch = e.date.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (ukDateMatch) {
          evtDate = new Date(parseInt(ukDateMatch[3], 10), parseInt(ukDateMatch[2], 10) - 1, parseInt(ukDateMatch[1], 10));
        }
        if (isNaN(evtDate.getTime())) return true;
        const today = new Date();
        today.setHours(0,0,0,0);
        return evtDate >= today;
      });
    }

    return (
      <div className="card glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>
            {isEditing && !selectedItem._rowIndex ? `New ${activeSubTab === 'People' ? 'Person' : activeSubTab === 'Companies' ? 'Company' : activeSubTab === 'Events' ? 'Event' : 'Opportunity'}` : targetTitle}
          </h2>
          <div>
            {!isEditing && selectedItem._rowIndex && (
              <button 
                className="btn" 
                style={{ marginRight: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }} 
                onClick={handleDeleteRecord}
              >
                Delete
              </button>
            )}
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
                const options = getDropdownOptionsFallback(activeTabObj, key);
                
                const isDateField = key.includes('date');
                const isCompanyField = (key === 'company' || key === 'companyname' || key === 'linkedcompanies');
                const isPersonField = (key === 'contact' || key === 'person' || key === 'linkedpeople');
                
                return (
                  <div key={key} style={{ display: 'flex', marginBottom: '0.5rem', alignItems: 'center' }}>
                    <span style={{ width: '150px', color: 'var(--text-secondary)' }}>{header}:</span>
                    {isCompanyField ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {(editFormData[key] || '').split(',').map((c: string) => c.trim()).filter(Boolean).map((c: string) => (
                            <span key={c} style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              {c} <X size={12} style={{ cursor: 'pointer' }} onClick={() => {
                                const newArray = (editFormData[key] || '').split(',').map((x: string) => x.trim()).filter(Boolean).filter((x: string) => x !== c);
                                setEditFormData({...editFormData, [key]: newArray.join(', ')});
                              }} />
                            </span>
                          ))}
                        </div>
                        <input
                          list={`companies-list-${activeTabObj}-${key}`}
                          className="input-field"
                          style={{ padding: '0.3rem 0.5rem' }}
                          value={tempInputs[key] || ''}
                          onChange={(e) => setTempInputs({...tempInputs, [key]: e.target.value})}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && tempInputs[key]?.trim()) {
                              e.preventDefault();
                              const currentList = (editFormData[key] || '').split(',').map((x: string) => x.trim()).filter(Boolean);
                              const val = tempInputs[key].trim();
                              if (!currentList.includes(val)) {
                                setEditFormData({...editFormData, [key]: [...currentList, val].join(', ')});
                              }
                              setTempInputs({...tempInputs, [key]: ''});
                            }
                          }}
                          placeholder="Type and press Enter..."
                        />
                        <datalist id={`companies-list-${activeTabObj}-${key}`}>
                          {companies.map((c: any) => {
                            const cName = c.companyname || c.name;
                            if (cName) return <option key={c.id || Math.random()} value={cName} />;
                            return null;
                          })}
                        </datalist>
                      </div>
                    ) : isPersonField ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {(editFormData[key] || '').split(',').map((p: string) => p.trim()).filter(Boolean).map((p: string) => (
                            <span key={p} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              {p} <X size={12} style={{ cursor: 'pointer' }} onClick={() => {
                                const newArray = (editFormData[key] || '').split(',').map((x: string) => x.trim()).filter(Boolean).filter((x: string) => x !== p);
                                setEditFormData({...editFormData, [key]: newArray.join(', ')});
                              }} />
                            </span>
                          ))}
                        </div>
                        <input
                          list={`people-list-${activeTabObj}-${key}`}
                          className="input-field"
                          style={{ padding: '0.3rem 0.5rem' }}
                          value={tempInputs[key] || ''}
                          onChange={(e) => setTempInputs({...tempInputs, [key]: e.target.value})}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && tempInputs[key]?.trim()) {
                              e.preventDefault();
                              const currentList = (editFormData[key] || '').split(',').map((x: string) => x.trim()).filter(Boolean);
                              const val = tempInputs[key].trim();
                              if (!currentList.includes(val)) {
                                setEditFormData({...editFormData, [key]: [...currentList, val].join(', ')});
                              }
                              setTempInputs({...tempInputs, [key]: ''});
                            }
                          }}
                          placeholder="Type and press Enter..."
                        />
                        <datalist id={`people-list-${activeTabObj}-${key}`}>
                          {people.map((p: any) => {
                            const pName = p.name || p.fullname;
                            if (pName) return <option key={p.id || Math.random()} value={pName} />;
                            return null;
                          })}
                        </datalist>
                      </div>
                    ) : options && options.length > 0 ? (
                      <select
                        className="input-field"
                        style={{ flex: 1, padding: '0.3rem 0.5rem', appearance: 'auto', backgroundColor: 'rgba(0,0,0,0.2)', color: '#fff' }}
                        value={editFormData[key] || ''}
                        onChange={(e) => setEditFormData({...editFormData, [key]: e.target.value})}
                      >
                        <option value=""></option>
                        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : (
                      <input 
                        type={isDateField ? 'date' : 'text'} 
                        className="input-field" 
                        style={{ flex: 1, padding: '0.3rem 0.5rem' }}
                        value={editFormData[key] || ''}
                        onChange={(e) => setEditFormData({...editFormData, [key]: e.target.value})}
                      />
                    )}
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
            <div 
              style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', marginBottom: '1.5rem', cursor: 'pointer', transition: 'background 0.2s' }}
              onClick={() => setSelectedItem(relatedCompany)}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.2)'}
            >
              <h3 style={{ margin: 0, fontSize: '1.1rem', marginBottom: '1rem', color: '#38bdf8' }}>
                <Building2 size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'text-bottom' }}/>
                Related Company: {relatedCompany.companyname || relatedCompany.name}
              </h3>
              <div className="grid-2" style={{ fontSize: '0.95rem' }}>
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
                    <div className="grid-2" style={{ gap: '0.5rem', fontSize: '0.9rem' }}>
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

          {!isEditing && relatedEvents.length > 0 && (activeTabObj === 'People' || activeTabObj === 'Companies') && (
            <div style={{ padding: '1rem', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '8px', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', marginBottom: '1rem', color: '#38bdf8' }}>
                <Target size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'text-bottom' }}/>
                Upcoming Events
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {relatedEvents.map((evt, idx) => (
                  <div key={idx} style={{ padding: '0.8rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                    <div style={{ fontWeight: 500, color: '#fff', marginBottom: '0.5rem' }}>{evt.eventname || evt.name || evt.title || `Event ${idx+1}`}</div>
                    <div className="grid-2" style={{ gap: '0.5rem', fontSize: '0.9rem' }}>
                      <div><span style={{ color: 'var(--text-secondary)' }}>Date:</span> {evt.date || '-'}</div>
                      <div><span style={{ color: 'var(--text-secondary)' }}>Type:</span> {evt.type || '-'}</div>
                      <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--text-secondary)' }}>Location:</span> {evt.location || '-'}</div>
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
                  <div 
                    key={p.id} 
                    style={{ display: 'flex', justifyContent: 'space-between', padding: '0.8rem', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.2s' }}
                    onClick={() => setSelectedItem(p)}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  >
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
              <div className="grid-2" style={{ marginBottom: '1rem' }}>
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
              <div className="grid-2" style={{ marginBottom: '1rem' }}>
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
    <>
      <style>{`
        .sales-main-grid {
          display: grid;
          grid-template-columns: ${selectedItem ? '1fr 1fr' : '1fr'};
          gap: 1.5rem;
          height: calc(100vh - 180px);
        }
        .sales-main-grid > div {
          min-width: 0;
        }
        @media (max-width: 900px) {
          .sales-main-grid {
            grid-template-columns: 1fr !important;
            display: flex !important;
            flex-direction: column !important;
            height: auto !important;
          }
          .sales-main-grid > div {
            height: auto !important;
            min-height: 50vh !important;
            max-height: 80vh !important;
          }
      `}</style>
      <div className="sales-main-grid">
      {/* Left List View */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
        <div className="card glass-panel sub-tabs-container">
          <button 
            className={`tab ${activeSubTab === 'Dashboard' ? 'active' : ''}`}
            onClick={() => { setActiveSubTab('Dashboard'); setSelectedItem(null); setIsEditing(false); }}
          >
            <BarChart2 size={16} /> Dashboard
          </button>
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
          <button 
            className={`tab ${activeSubTab === 'Meetings' ? 'active' : ''}`}
            onClick={() => { setActiveSubTab('Meetings'); setSelectedItem(null); setIsEditing(false); }}
            style={{ margin: 0, flex: 1, justifyContent: 'center' }}
          >
            <Calendar size={16} /> Meetings
          </button>
          <button 
            className={`tab ${activeSubTab === 'Events' ? 'active' : ''}`}
            onClick={() => { setActiveSubTab('Events'); setSelectedItem(null); setIsEditing(false); }}
            style={{ margin: 0, flex: 1, justifyContent: 'center' }}
          >
            <Target size={16} /> Events
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexShrink: 0 }}>
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
            <Plus size={16} /> New {activeSubTab === 'People' ? 'Person' : activeSubTab === 'Companies' ? 'Company' : activeSubTab === 'Tasks' ? 'Task' : activeSubTab === 'Events' ? 'Event' : 'Opportunity'}
          </button>
        </div>

        {error && <div style={{ color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px' }}>{error}</div>}
        
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Loading data from Google Sheets...</div>
        ) : (
          <div style={{ overflowY: 'auto', paddingRight: '0.5rem' }}>
            {activeSubTab === 'Dashboard' && renderDashboard()}
            {activeSubTab === 'Tasks' && renderTasks()}
            {activeSubTab === 'Opportunities' && renderOpportunities()}
            {activeSubTab === 'People' && renderPeople()}
            {activeSubTab === 'Companies' && renderCompanies()}
            {activeSubTab === 'Meetings' && renderMeetings()}
            {activeSubTab === 'Events' && renderEvents()}
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

    {linkingItem && (
      <div className="modal-overlay" onClick={() => setLinkingItem(null)}>
        <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%', padding: '1.5rem' }}>
          <h2 style={{ margin: '0 0 1rem 0', color: '#fff', fontSize: '1.2rem' }}>
            Link to Event
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
            Select an upcoming event to link {linkingItem.type === 'person' ? (linkingItem.data.name || linkingItem.data.fullname) : (linkingItem.data.companyname || linkingItem.data.name)} to:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
            {events.map(evt => (
              <button
                key={evt._rowIndex || Math.random()}
                onClick={() => handleLinkToEvent(evt)}
                className="btn"
                style={{ textAlign: 'left', background: 'rgba(255,255,255,0.05)', padding: '0.75rem', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', opacity: isLinkingEvent ? 0.5 : 1 }}
                disabled={isLinkingEvent}
              >
                <span style={{ fontWeight: 500, color: '#fff' }}>{evt.eventname || evt.name || evt.title || 'Untitled Event'}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {evt.date || ''}
                </span>
              </button>
            ))}
            {(!events || events.length === 0) && (
              <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>No events found in CRM.</div>
            )}
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setLinkingItem(null)}>Cancel</button>
          </div>
        </div>
      </div>
    )}

    </>
  );
}
