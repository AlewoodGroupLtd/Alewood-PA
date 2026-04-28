import { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { ShieldAlert, Fingerprint } from 'lucide-react';

export default function LoginScreen() {
  const [error, setError] = useState('');

  const handleLogin = async () => {
    try {
      setError('');
      // This will prompt for Google login. 
      // If the user's Google account is configured for Passkeys, it will natively ask for FaceID / Fingerprint!
      const result = await signInWithPopup(auth, googleProvider);
      
      // Strict CEO validation
      if (result.user.email !== 'craig@alewood.co.uk') {
        await auth.signOut();
        setError('Unauthorized access. Only craig@alewood.co.uk is permitted.');
        return;
      }

      // Extract the Google OAuth Token to be used for Workspace APIs
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        localStorage.setItem('googleAccessToken', credential.accessToken);
      }
    } catch (err: any) {
      setError('Authentication failed. ' + (err.message || ''));
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexGrow: 1,
      width: '100%',
      padding: '2rem'
    }}>
      <div className="card glass-panel" style={{ maxWidth: '400px', width: '100%', alignItems: 'center', textAlign: 'center' }}>
        <img src="/alewood-logo.png" alt="Alewood Logo" style={{ height: '140px', width: 'auto', objectFit: 'contain', marginBottom: '1.5rem' }} />
        
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>CEO Authentication</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>
          This portal is restricted to Alewood executive devices.
        </p>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--danger)',
            color: 'var(--danger)',
            padding: '1rem',
            borderRadius: '0.5rem',
            marginBottom: '1.5rem',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            textAlign: 'left'
          }}>
            <ShieldAlert size={18} />
            {error}
          </div>
        )}

        <button className="btn" onClick={handleLogin} style={{ width: '100%', justifyContent: 'center' }}>
          <Fingerprint size={20} />
          Authenticate with Device / Google
        </button>
      </div>
    </div>
  );
}
