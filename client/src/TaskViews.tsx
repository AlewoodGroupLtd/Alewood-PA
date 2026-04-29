

export function KanbanView({ tasks, onTaskClick, onTaskUpdate }: { tasks: any[], onTaskClick: (task: any) => void, onTaskUpdate?: (task: any) => void }) {
  const statuses = ['Open', 'In Progress', 'Blocked', 'Done'];

  return (
    <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem', alignItems: 'flex-start' }}>
      {statuses.map(status => {
        const columnTasks = tasks.filter(t => t.status === status);
        return (
          <div 
            key={status} 
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const taskId = e.dataTransfer.getData('taskId');
              const task = tasks.find(t => t.id.toString() === taskId);
              if (task && task.status !== status && onTaskUpdate) {
                onTaskUpdate({ ...task, status });
              }
            }}
            style={{ minWidth: '280px', flex: 1, background: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem', padding: '0.75rem', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>{status}</span>
              <span style={{ background: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.4rem', borderRadius: '1rem', fontSize: '0.75rem' }}>{columnTasks.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {columnTasks.map(t => (
                <div 
                  key={t.id} 
                  draggable={true}
                  onDragStart={(e) => e.dataTransfer.setData('taskId', t.id.toString())}
                  onClick={() => onTaskClick(t)}
                  style={{ 
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', 
                    padding: '0.75rem', borderRadius: '0.5rem', cursor: 'grab', transition: 'background 0.2s',
                    borderLeft: t.priority === 'High' ? '3px solid var(--danger)' : t.priority === 'Medium' ? '3px solid #f59e0b' : 'none'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                >
                  <div style={{ fontSize: '0.9rem', fontWeight: 500, color: '#fff', marginBottom: '0.5rem', lineHeight: 1.4 }}>{t.task}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span>{t.assignee}</span>
                    <span>{t.dueDate !== 'TBD' ? new Date(t.dueDate).toLocaleDateString('en-GB') : ''}</span>
                  </div>
                </div>
              ))}
              {columnTasks.length === 0 && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem 0' }}>Empty</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function GanttView({ tasks, onTaskClick, onTaskUpdate }: { tasks: any[], onTaskClick: (task: any) => void, onTaskUpdate?: (task: any) => void }) {
  // Sort tasks by due date
  const sortedTasks = [...tasks].filter(t => t.status !== 'Done').sort((a, b) => {
    if (a.dueDate === 'TBD') return 1;
    if (b.dueDate === 'TBD') return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  if (sortedTasks.length === 0) {
    return <div style={{ padding: '1rem', color: 'var(--text-secondary)' }}>No active tasks to display in timeline.</div>;
  }

  // Find min and max dates
  let minDate = new Date();
  let maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 14); // Default to 2 weeks out

  sortedTasks.forEach(t => {
    if (t.createdAt) {
      const created = new Date(t.createdAt);
      if (created < minDate) minDate = created;
    }
    if (t.dueDate !== 'TBD') {
      const due = new Date(t.dueDate);
      if (due > maxDate) maxDate = due;
    }
  });

  const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 3600 * 24)) + 2; // +2 for padding
  const dayWidth = 20;

  return (
    <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.05)', padding: '1rem' }}>
      <div style={{ minWidth: `${totalDays * dayWidth + 200}px`, position: 'relative' }}>
        
        {/* Header timeline */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '0.5rem', marginLeft: '200px' }}>
          {Array.from({ length: totalDays }).map((_, i) => {
            const d = new Date(minDate);
            d.setDate(d.getDate() + i);
            const isToday = d.toDateString() === new Date().toDateString();
            return (
              <div key={i} style={{ width: `${dayWidth}px`, flexShrink: 0, fontSize: '0.65rem', color: isToday ? '#f59e0b' : 'var(--text-secondary)', textAlign: 'center', fontWeight: isToday ? 700 : 400 }}>
                {d.getDate()}
              </div>
            );
          })}
        </div>

        {/* Task rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {sortedTasks.map(t => {
            const start = t.createdAt ? new Date(t.createdAt) : new Date();
            const end = t.dueDate !== 'TBD' ? new Date(t.dueDate) : new Date(start.getTime() + 3 * 24 * 3600 * 1000); // default 3 days
            
            const startOffset = Math.max(0, Math.floor((start.getTime() - minDate.getTime()) / (1000 * 3600 * 24)));
            const duration = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)));
            
            const isOverdue = t.dueDate !== 'TBD' && new Date(t.dueDate) < new Date();

            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', height: '30px' }}>
                <div onClick={() => onTaskClick(t)} style={{ width: '190px', paddingRight: '10px', fontSize: '0.8rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }} title={t.task}>
                  {t.task}
                </div>
                <div 
                  style={{ position: 'relative', height: '100%', flex: 1, borderLeft: '1px solid rgba(255,255,255,0.05)' }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const taskId = e.dataTransfer.getData('taskId');
                    const offsetX = parseFloat(e.dataTransfer.getData('offsetX') || '0');
                    const task = tasks.find(tsk => tsk.id.toString() === taskId);
                    if (!task || !onTaskUpdate) return;
                    
                    const trackRect = e.currentTarget.getBoundingClientRect();
                    const dropX = e.clientX - trackRect.left - offsetX;
                    const newStartOffset = Math.round(dropX / dayWidth);
                    
                    const currentStart = task.createdAt ? new Date(task.createdAt) : new Date();
                    const currentEnd = task.dueDate !== 'TBD' ? new Date(task.dueDate) : new Date(currentStart.getTime() + 3 * 24 * 3600 * 1000);
                    const durationDays = Math.max(1, Math.ceil((currentEnd.getTime() - currentStart.getTime()) / (1000 * 3600 * 24)));
                    
                    const newStart = new Date(minDate);
                    newStart.setDate(newStart.getDate() + newStartOffset);
                    
                    const newEnd = new Date(newStart);
                    newEnd.setDate(newStart.getDate() + durationDays);
                    
                    onTaskUpdate({ 
                      ...task, 
                      createdAt: newStart.toISOString(), 
                      dueDate: newEnd.toISOString().split('T')[0] 
                    });
                  }}
                >
                  <div 
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('taskId', t.id.toString());
                      const rect = e.currentTarget.getBoundingClientRect();
                      const offsetX = e.clientX - rect.left;
                      e.dataTransfer.setData('offsetX', offsetX.toString());
                    }}
                    style={{
                      position: 'absolute',
                      left: `${startOffset * dayWidth}px`,
                      width: `${duration * dayWidth}px`,
                      height: '20px',
                      top: '5px',
                      background: isOverdue ? 'rgba(239, 68, 68, 0.4)' : t.status === 'In Progress' ? 'rgba(56, 189, 248, 0.4)' : 'rgba(16, 185, 129, 0.4)',
                      border: `1px solid ${isOverdue ? '#ef4444' : t.status === 'In Progress' ? '#38bdf8' : '#10b981'}`,
                      borderRadius: '4px',
                      cursor: 'grab'
                    }} 
                    title={`${t.status} - Due: ${t.dueDate !== 'TBD' ? new Date(t.dueDate).toLocaleDateString('en-GB') : 'TBD'}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
