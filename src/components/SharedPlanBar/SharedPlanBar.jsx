import { useState } from 'react';
import { Cloud, CloudUpload, LogIn, LogOut, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

function OwnerLogin({ onClose }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'grid', placeItems: 'center', background: 'rgba(2, 6, 23, 0.72)', padding: '20px' }}>
      <form onSubmit={handleSubmit} style={{ width: 'min(420px, 100%)', padding: '24px', borderRadius: '14px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', boxShadow: '0 24px 70px rgba(0,0,0,.45)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Owner sign in</h2>
            <p style={{ margin: '5px 0 0', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Sign in to edit and publish the shared sitemap.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close owner sign in" style={{ color: 'var(--text-secondary)' }}><X size={19} /></button>
        </div>
        <label style={{ display: 'block', marginBottom: '14px', fontSize: '0.82rem', fontWeight: 600 }}>
          Email
          <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)' }} />
        </label>
        <label style={{ display: 'block', marginBottom: '14px', fontSize: '0.82rem', fontWeight: 600 }}>
          Password
          <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)' }} />
        </label>
        {error && <p role="alert" style={{ color: '#fda4af', fontSize: '0.8rem' }}>{error}</p>}
        <button disabled={submitting} type="submit" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--primary-color)', color: 'var(--primary-text)', fontWeight: 700 }}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

export default function SharedPlanBar({ configured, user, canEdit, status, updatedAt, onPublish, publishing }) {
  const [loginOpen, setLoginOpen] = useState(false);

  if (!configured) return null;

  const signOut = () => supabase.auth.signOut();

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '6px 10px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-color)', color: 'var(--text-secondary)', fontSize: '0.74rem' }}>
        <Cloud size={15} style={{ color: status === 'error' ? '#fda4af' : 'var(--primary-color)' }} />
        <span>
          {status === 'loading' && 'Loading shared sitemap…'}
          {status === 'error' && 'Shared sitemap unavailable'}
          {status === 'empty' && 'No shared sitemap published yet'}
          {status === 'ready' && (canEdit ? 'Owner mode' : 'Public view')}
          {updatedAt && status === 'ready' && ` · updated ${new Date(updatedAt).toLocaleString()}`}
        </span>
        {canEdit ? (
          <>
            <button onClick={onPublish} disabled={publishing} style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--primary-color)', fontWeight: 700 }}>
              <CloudUpload size={15} /> {publishing ? 'Publishing…' : 'Publish changes'}
            </button>
            <button onClick={signOut} title="Sign out" aria-label="Sign out" style={{ color: 'var(--text-secondary)' }}><LogOut size={15} /></button>
          </>
        ) : user ? (
          <>
            <span>Signed in without owner access</span>
            <button onClick={signOut} title="Sign out" aria-label="Sign out" style={{ color: 'var(--text-secondary)' }}><LogOut size={15} /></button>
          </>
        ) : (
          <button onClick={() => setLoginOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--primary-color)', fontWeight: 700 }}>
            <LogIn size={15} /> Owner sign in
          </button>
        )}
      </div>
      {loginOpen && <OwnerLogin onClose={() => setLoginOpen(false)} />}
    </>
  );
}
