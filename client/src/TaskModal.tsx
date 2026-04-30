import { useState } from 'react';
import { X, Save } from 'lucide-react';

export default function TaskModal({ task, onClose, onSave }: { task: any, onClose: () => void, onSave: (updatedTask: any) => void }) {
  const [editedTask, setEditedTask] = useState({ ...task });
  const [saving, setSaving] = useState(false);

  const handleChange = (field: string, value: string) => {
    setEditedTask((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('googleAccessToken');
      if (!token) throw new Error("Not authenticated with Google");

      const SPREADSHEET_ID = '1yskd_H80YpKH5pW1vwpVVyIi49Ce86m87VQP99VJ2mw';
      const rowIdx = editedTask.rowIdx;

      // Check if status changed to Done
      let completedAt = editedTask.completedAt || "";
      if (editedTask.status === 'Done' && task.status !== 'Done') {
        completedAt = new Date().toISOString();
      } else if (editedTask.status !== 'Done') {
        completedAt = "";
      }

      const updatedTaskObj = { ...editedTask, completedAt };

      const values = [
        [
          updatedTaskObj.task,
          updatedTaskObj.assignee,
          updatedTaskObj.priority,
          updatedTaskObj.status,
          updatedTaskObj.dueDate,
          updatedTaskObj.sourceUrl || "",
          updatedTaskObj.category || "Project Management",
          updatedTaskObj.createdAt || "",
          completedAt,
          updatedTaskObj.comments || ""
        ]
      ];

      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Pipeline!A${rowIdx}:J${rowIdx}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || "Failed to update spreadsheet");
      }

      onSave(updatedTaskObj);
    } catch (err: any) {
      console.error(err);
      alert(`Failed to save task: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, padding: '1rem'
    }}>
      <div className="card glass-panel" style={{ width: '100%', maxWidth: '500px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Edit Task</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} color="#fff" /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Task Description</label>
            <input 
              type="text" 
              value={editedTask.task} 
              onChange={e => handleChange('task', e.target.value)}
              style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', color: '#fff' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Status</label>
              <select 
                value={editedTask.status} 
                onChange={e => handleChange('status', e.target.value)}
                style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', color: '#fff', appearance: 'auto' }}
              >
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Blocked">Blocked</option>
                <option value="Done">Done</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Priority</label>
              <select 
                value={editedTask.priority} 
                onChange={e => handleChange('priority', e.target.value)}
                style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', color: '#fff', appearance: 'auto' }}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Due Date</label>
              <input 
                type="date" 
                value={editedTask.dueDate === 'TBD' ? '' : editedTask.dueDate} 
                onChange={e => handleChange('dueDate', e.target.value || 'TBD')}
                style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', color: '#fff', colorScheme: 'dark' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Assignee</label>
              <input 
                type="text" 
                value={editedTask.assignee} 
                onChange={e => handleChange('assignee', e.target.value)}
                style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', color: '#fff' }}
              />
            </div>
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Category / Department</label>
            <select 
              value={editedTask.category} 
              onChange={e => handleChange('category', e.target.value)}
              style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', color: '#fff', appearance: 'auto' }}
            >
              <option value="Product Build">Product Build</option>
              <option value="Project Management">Project Management</option>
              <option value="HR">HR</option>
              <option value="Finance">Finance</option>
              <option value="Legal">Legal</option>
              <option value="Operations">Operations</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Source URL</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                value={editedTask.sourceUrl || ''} 
                onChange={e => handleChange('sourceUrl', e.target.value)}
                placeholder="https://..."
                style={{ flex: 1, padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', color: '#fff' }}
              />
              {editedTask.sourceUrl && (
                <a 
                  href={editedTask.sourceUrl.startsWith('http') ? editedTask.sourceUrl : `https://${editedTask.sourceUrl}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="btn"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '0 1rem' }}
                >
                  Open
                </a>
              )}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Comments</label>
            <textarea 
              value={editedTask.comments || ''} 
              onChange={e => handleChange('comments', e.target.value)}
              placeholder="Add updates or comments about this task..."
              style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', color: '#fff', minHeight: '80px', resize: 'vertical' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
          <button className="btn" onClick={onClose} style={{ flex: 1, background: 'rgba(255,255,255,0.1)' }}>Cancel</button>
          <button className="btn" onClick={handleSave} disabled={saving} style={{ flex: 1, background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {saving ? 'Saving...' : <><Save size={18} style={{ marginRight: '0.5rem' }} /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}
