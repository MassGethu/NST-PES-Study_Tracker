import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/StoreContext.jsx';
import { readLegacy, downloadBackup } from '../store/accountStorage.js';

export default function Login() {
  const { login, account } = useStore();
  const navigate = useNavigate();
  const [username, setUsername] = useState('aadarsh');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const busy = account.status === 'checking';
  return <main className="login-shell"><div className="card login-card">
    <div className="logo-icon" style={{ marginBottom: 20 }}>N</div>
    <h1>Welcome back</h1>
    <p style={{ margin: '12px 0 24px' }}>Your own space to learn, plan and make progress.</p>
    <div className="flex gap-3" style={{ marginBottom: 24 }}>
      {['aadarsh', 'rithika'].map(name => <button key={name} type="button" aria-pressed={username === name}
        className={`btn ${username === name ? 'btn-primary' : 'btn-secondary'}`}
        disabled={busy} onClick={() => { setUsername(name); setPassword(''); }}>
        {name === 'aadarsh' ? 'Aadarsh' : 'Rithika'}
      </button>)}
    </div>
    <form className="flex flex-col gap-4" onSubmit={async event => {
      event.preventDefault(); setMessage(''); const result = await login({ username, password }); setPassword('');
      if (result.ok) navigate('/', { replace: true });
    }}>
      <label className="form-group">Username<input autoComplete="username" required value={username} disabled={busy} onChange={e => setUsername(e.target.value)} /></label>
      <label className="form-group">Password<input type="password" autoComplete="current-password" required maxLength={128} value={password} disabled={busy} onChange={e => setPassword(e.target.value)} /></label>
      {account.error && <p role="alert" className="form-error">{account.error}</p>}
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Connecting…' : 'Sign in'}</button>
    </form>
    <p className="text-muted text-sm" style={{ marginTop: 20 }}>Choosing a name does not sign you in. Each account requires its own password.</p>
    {['localhost', '127.0.0.1'].includes(window.location.hostname) && <div style={{ marginTop: 24 }}>
      <button className="btn btn-ghost btn-sm" onClick={() => {
        try { const legacy = readLegacy(); if (!legacy) throw new Error('No old tracker data was found at this local address.');
          downloadBackup(legacy, 'aadarsh-local-original'); setMessage('Backup downloaded. Your original local data was not changed.');
        } catch (error) { setMessage(error.message); }
      }}>Export existing local data</button>
      {message && <p role="status">{message}</p>}
    </div>}
  </div></main>;
}
