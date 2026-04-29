import { useState } from 'react';
import { X, Save, Plus, Trash2 } from 'lucide-react';

export default function IndustrySettingsModal({ onClose, onSave, initialConfig }: { onClose: () => void, onSave?: (config: any) => void, initialConfig?: any }) {
  const [competitors, setCompetitors] = useState<string[]>(initialConfig?.competitors || ['Recovery Dynamics', 'AssetWatch UK', 'DebtCollect Pro']);
  const [clients, setClients] = useState<string[]>(initialConfig?.clients || ['Banking Client X', 'Credit Union Y']);
  const [keywords, setKeywords] = useState<string[]>(initialConfig?.keywords || ['asset recovery software', 'field agent automation', 'debt collection AI']);
  const [pages, setPages] = useState<string[]>(initialConfig?.pages || ['https://www.linkedin.com/company/recovery-dynamics', 'https://www.linkedin.com/company/assetwatch-uk']);

  const [newCompetitor, setNewCompetitor] = useState('');
  const [newClient, setNewClient] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [newPage, setNewPage] = useState('');

  const handleSave = () => {
    const config = { competitors, clients, keywords, pages };
    
    if (onSave) {
      onSave(config);
    } else {
      onClose();
    }
  };

  const addItem = (setter: any, value: string, clearValue: any) => {
    if (!value.trim()) return;
    setter((prev: string[]) => [...prev, value.trim()]);
    clearValue('');
  };

  const removeItem = (setter: any, index: number) => {
    setter((prev: string[]) => prev.filter((_, i) => i !== index));
  };

  const renderSection = (title: string, items: string[], setter: any, newValue: string, setNewValue: any, placeholder: string) => (
    <div style={{ marginBottom: '1.5rem' }}>
      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#fff', fontWeight: 500 }}>{title}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
        {items.map((item, idx) => (
          <div key={idx} style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '0.25rem 0.75rem', borderRadius: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <span>{item}</span>
            <button onClick={() => removeItem(setter, idx)} className="icon-btn" style={{ background: 'transparent', padding: 0, margin: 0, width: 'auto', height: 'auto' }}>
              <Trash2 size={14} color="#ef4444" />
            </button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input 
          type="text" 
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(setter, newValue, setNewValue); } }}
          placeholder={placeholder}
          className="chat-input"
          style={{ flex: 1, padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
        />
        <button onClick={() => addItem(setter, newValue, setNewValue)} className="btn" style={{ background: 'rgba(255,255,255,0.1)', padding: '0.4rem 0.8rem', marginTop: 0 }}>
          <Plus size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel" style={{ maxWidth: '600px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', position: 'sticky', top: 0, background: 'var(--bg-card)', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', zIndex: 10 }}>
          <h2 style={{ margin: 0, color: '#fff', fontSize: '1.2rem' }}>Industry Intelligence Settings</h2>
          <button onClick={onClose} className="icon-btn" style={{ background: 'transparent', padding: '0.2rem' }}>
            <X size={20} color="#fff" />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Configure the entities and keywords you want Moltbot to monitor across the web and LinkedIn.
          </p>

          {renderSection('Monitored Competitors', competitors, setCompetitors, newCompetitor, setNewCompetitor, 'Add a competitor name...')}
          {renderSection('Potential / Current Clients', clients, setClients, newClient, setNewClient, 'Add a client name...')}
          {renderSection('Key Industry Keywords', keywords, setKeywords, newKeyword, setNewKeyword, 'Add a search keyword...')}
          {renderSection('Target LinkedIn Pages', pages, setPages, newPage, setNewPage, 'Add a LinkedIn company URL...')}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', position: 'sticky', bottom: 0, background: 'var(--bg-card)', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <button 
              className="btn" 
              onClick={handleSave} 
              style={{ flex: 1, background: '#10b981', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <Save size={18} style={{ marginRight: '0.5rem' }} />
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
