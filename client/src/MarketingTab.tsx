import { useState, useEffect } from 'react';
import { Send, Settings, Check, Loader2 } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { app, auth, db } from './firebase';

export default function MarketingTab() {
  const [bufferToken, setBufferToken] = useState('');
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [postText, setPostText] = useState('');
  const [postMode, setPostMode] = useState('addToQueue');
  const [scheduledTime, setScheduledTime] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const loadToken = async () => {
      const localToken = localStorage.getItem('bufferAccessToken');
      if (localToken) {
        setBufferToken(localToken);
      }
      
      const user = auth.currentUser;
      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists() && docSnap.data().bufferAccessToken) {
            // Firestore has the token, use it and update local
            const token = docSnap.data().bufferAccessToken;
            setBufferToken(token);
            localStorage.setItem('bufferAccessToken', token);
            setShowSettings(false);
          } else if (localToken) {
            // Local storage has it but Firestore doesn't -> sync it up
            try {
              await setDoc(docRef, { bufferAccessToken: localToken }, { merge: true });
            } catch (e) {
              console.error("Failed to sync local token to Firestore", e);
            }
            setShowSettings(false);
          } else {
            // Neither have it
            setShowSettings(true);
          }
        } catch (e) {
          console.error("Failed to load Buffer token from Firestore", e);
        }
      } else if (!localToken) {
        setShowSettings(true);
      }
    };
    loadToken();
  }, []);

  useEffect(() => {
    if (bufferToken && !showSettings) {
      fetchProfiles();
    }
  }, [bufferToken, showSettings]);

  const saveToken = async (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('bufferAccessToken', bufferToken);
    
    const user = auth.currentUser;
    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid), { bufferAccessToken: bufferToken }, { merge: true });
      } catch (err) {
        console.error("Failed to save token to Firestore", err);
      }
    }
    
    setShowSettings(false);
  };

  const fetchProfiles = async () => {
    setIsLoadingProfiles(true);
    try {
      const functions = getFunctions(app, 'europe-west2');
      const bufferGetProfiles = httpsCallable(functions, 'bufferGetProfiles');
      const res = await bufferGetProfiles({ bufferToken });
      const data = res.data as any[];

      setProfiles(data);
      // Auto-select all by default
      setSelectedProfiles(data.map((p: any) => p.id));
    } catch (err: any) {
      console.error(err);
      alert("Error fetching Buffer profiles. Check your API token. Details: " + err.message);
    } finally {
      setIsLoadingProfiles(false);
    }
  };

  const toggleProfile = (id: string) => {
    setSelectedProfiles(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handlePost = async () => {
    if (!postText.trim()) return alert("Please enter some text to post.");
    if (selectedProfiles.length === 0) return alert("Please select at least one social profile.");
    
    setIsPosting(true);
    setSuccessMessage('');
    
    try {
      const functions = getFunctions(app, 'europe-west2');
      const bufferCreateUpdate = httpsCallable(functions, 'bufferCreateUpdate');
      await bufferCreateUpdate({ 
        bufferToken, 
        text: postText, 
        profileIds: selectedProfiles,
        mode: postMode,
        dueAt: postMode === 'customScheduled' ? scheduledTime : undefined
      });

      setSuccessMessage(postMode === 'shareNow' ? 'Post published successfully!' : 'Post successfully scheduled in Buffer!');
      setPostText('');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      console.error(err);
      alert(`Error posting: ${err.message}`);
    } finally {
      setIsPosting(false);
    }
  };

  if (showSettings) {
    return (
      <div className="card glass-panel" style={{ gridColumn: '1 / -1' }}>
        <div className="card-header">
          <Settings color="#f43f5e" size={24} />
          Buffer API Configuration
        </div>
        <div className="card-content">
          <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            Please enter your Buffer Personal Access Token to enable social media posting.
            You can generate one in your Buffer dashboard under Account &gt; Apps &gt; Personal Access Tokens.
          </p>
          <form onSubmit={saveToken} style={{ display: 'flex', gap: '1rem' }}>
            <input 
              type="password" 
              value={bufferToken} 
              onChange={(e) => setBufferToken(e.target.value)} 
              placeholder="Buffer Access Token"
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                color: '#fff',
                outline: 'none'
              }}
            />
            <button type="submit" className="btn" style={{ background: '#f43f5e' }}>
              Save Token
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="card glass-panel" style={{ gridColumn: '1 / -1' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Send color="#f43f5e" size={24} />
          Marketing & Social Publishing
        </div>
        <button className="icon-btn" onClick={() => setShowSettings(true)}>
          <Settings size={20} color="var(--text-secondary)" />
        </button>
      </div>
      <div className="card-content">
        
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Select Profiles</label>
          {isLoadingProfiles ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
              <Loader2 className="spinner" size={16} /> Loading profiles...
            </div>
          ) : profiles.length === 0 ? (
            <div style={{ color: '#ef4444' }}>No profiles found. Check your API token.</div>
          ) : (
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {profiles.map(profile => {
                const isSelected = selectedProfiles.includes(profile.id);
                return (
                  <button
                    key={profile.id}
                    onClick={() => toggleProfile(profile.id)}
                    style={{
                      background: isSelected ? 'rgba(244, 63, 94, 0.2)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${isSelected ? '#f43f5e' : 'rgba(255,255,255,0.1)'}`,
                      color: isSelected ? '#f43f5e' : 'var(--text-secondary)',
                      padding: '0.5rem 1rem',
                      borderRadius: '2rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <img 
                      src={profile.avatar_https || profile.avatar} 
                      alt={profile.service} 
                      style={{ width: '20px', height: '20px', borderRadius: '50%' }} 
                    />
                    {profile.formatted_username} ({profile.service})
                    {isSelected && <Check size={14} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Compose Post</label>
          <textarea
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
            placeholder="What's on your mind? This will be published to your selected Buffer accounts."
            style={{
              width: '100%',
              minHeight: '120px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '1rem',
              borderRadius: '0.5rem',
              color: '#fff',
              outline: 'none',
              resize: 'vertical',
              fontFamily: 'inherit',
              lineHeight: 1.5,
              marginBottom: '1rem'
            }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ color: 'var(--text-secondary)' }}>Publish Mode:</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: postMode === 'shareNow' ? '#fff' : 'var(--text-secondary)' }}>
            <input type="radio" value="shareNow" checked={postMode === 'shareNow'} onChange={(e) => setPostMode(e.target.value)} />
            Post Immediately
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: postMode === 'addToQueue' ? '#fff' : 'var(--text-secondary)' }}>
            <input type="radio" value="addToQueue" checked={postMode === 'addToQueue'} onChange={(e) => setPostMode(e.target.value)} />
            Add to Queue
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: postMode === 'customScheduled' ? '#fff' : 'var(--text-secondary)' }}>
            <input type="radio" value="customScheduled" checked={postMode === 'customScheduled'} onChange={(e) => setPostMode(e.target.value)} />
            Schedule Specific Time
          </label>
        </div>

        {postMode === 'customScheduled' && (
          <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <label style={{ color: 'var(--text-secondary)' }}>Scheduled Time:</label>
            <input 
              type="datetime-local" 
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '0.5rem',
                borderRadius: '0.5rem',
                color: '#fff',
                outline: 'none'
              }}
            />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {successMessage && <span style={{ color: 'var(--success)' }}>{successMessage}</span>}
          </div>
          <button 
            onClick={handlePost} 
            disabled={isPosting || !postText.trim() || selectedProfiles.length === 0}
            className="btn" 
            style={{ 
              background: isPosting || !postText.trim() || selectedProfiles.length === 0 ? 'rgba(244, 63, 94, 0.5)' : '#f43f5e',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: isPosting || !postText.trim() || selectedProfiles.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            {isPosting ? <Loader2 className="spinner" size={16} /> : <Send size={16} />}
            {isPosting ? 'Sending to Buffer...' : (postMode === 'shareNow' ? 'Post Immediately' : postMode === 'customScheduled' ? 'Schedule Post' : 'Add to Buffer Queue')}
          </button>
        </div>
      </div>
    </div>
  );
}
