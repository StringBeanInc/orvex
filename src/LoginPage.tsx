
import { useState, type FormEvent } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      window.location.assign('/app');
    } catch {
      setError('Unable to sign in. Check your email and password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      background: '#f6f7f9',
      padding: 24,
    }}>
      <form
        onSubmit={handleLogin}
        style={{
          width: '100%',
          maxWidth: 400,
          background: '#fff',
          padding: 36,
          borderRadius: 16,
          boxShadow: '0 12px 40px rgba(0,0,0,0.07)',
        }}
      >
        <img
          src="/orvex-wordmark.png"
          alt="ORVEX"
          style={{ width: 170, marginBottom: 28 }}
        />

        <h1 style={{ fontSize: 26, marginBottom: 8 }}>Sign In</h1>
        <p style={{ color: '#666', marginBottom: 28 }}>
          Access your ORVEX workspace.
        </p>

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          style={{ width: '100%', padding: 12, margin: '8px 0 20px' }}
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          style={{ width: '100%', padding: 12, margin: '8px 0 20px' }}
        />

        {error && (
          <p role="alert" style={{ color: '#b42318', marginBottom: 16 }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: 14,
            background: '#242424',
            color: '#fff',
            border: 0,
            borderRadius: 8,
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? 'Signing In...' : 'Sign In'}
        </button>
      </form>
    </main>
  );
}
