
import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  reload,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFunctions,
  httpsCallable,
  connectFunctionsEmulator,
} from 'firebase/functions';
import { app, auth } from './firebase';

type Mode = 'login' | 'register' | 'verify';

type PendingRegistration = {
  uid: string;
  companyName: string;
  ownerName: string;
};

const STORAGE_KEY = 'orvex-pending-registration';

const functions = getFunctions(app, 'us-central1');

const emulatorMode =
  import.meta.env.DEV &&
  import.meta.env.VITE_FIREBASE_EMULATOR_PROJECT === 'demo-orvex';

if (emulatorMode) {
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

const signupEnabled = emulatorMode || import.meta.env.VITE_ENABLE_PUBLIC_SIGNUP === 'true';

const registerCompany = httpsCallable<
  { companyName: string; ownerName: string },
  { success: boolean; companyId: string }
>(functions, 'registerCompany');

const inputStyle: CSSProperties = {
  width: '100%',
  padding: 12,
  margin: '8px 0 18px',
  border: '1px solid #d0d5dd',
  borderRadius: 8,
  boxSizing: 'border-box',
};

function readPending(): PendingRegistration | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const data: unknown = JSON.parse(raw);

    if (
      typeof data === 'object' &&
      data !== null &&
      'uid' in data &&
      'companyName' in data &&
      'ownerName' in data &&
      typeof data.uid === 'string' &&
      typeof data.companyName === 'string' &&
      typeof data.ownerName === 'string'
    ) {
      return {
        uid: data.uid,
        companyName: data.companyName,
        ownerName: data.ownerName,
      };
    }
  } catch {
    // Invalid or unavailable session storage.
  }

  return null;
}

export default function LoginPage() {
  const requestedMode =
    new URLSearchParams(window.location.search).get('mode');

  const [mode, setMode] = useState<Mode>(
    signupEnabled && requestedMode === 'register'
      ? 'register'
      : requestedMode === 'verify'
        ? 'verify'
        : 'login'
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      const pending = readPending();

      if (user && pending?.uid === user.uid) {
        setCompanyName(pending.companyName);
        setOwnerName(pending.ownerName);
        setMode('verify');
        window.history.replaceState({}, '', '/account?mode=verify');
      }

      setAuthReady(true);
    });
  }, []);

  function changeMode(next: Mode) {
    if (next === 'register' && !signupEnabled) return;
    setMode(next);
    setShowPassword(false);
    setError('');
    setMessage('');
    window.history.replaceState({}, '', `/account?mode=${next}`);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const result = await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

        await reload(result.user);

        const pending = readPending();

        if (pending?.uid === result.user.uid) {
          setCompanyName(pending.companyName);
          setOwnerName(pending.ownerName);
          changeMode('verify');
          return;
        }

        if (!result.user.emailVerified) {
          setError('Please verify your email before signing in.');
          return;
        }

        window.location.assign('/app');
        return;
      }

      if (mode === 'register') {
        if (!signupEnabled) throw new Error('Company registration is temporarily unavailable.');
        const name = companyName.trim();
        const owner = ownerName.trim();

        if (name.length < 2 || owner.length < 2) {
          throw new Error('Enter a valid company and owner name.');
        }

        const result = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            uid: result.user.uid,
            companyName: name,
            ownerName: owner,
          } satisfies PendingRegistration)
        );

        await sendEmailVerification(result.user);

        changeMode('verify');
        setMessage(
          'We sent a verification email. Open the link, then return here.'
        );
        return;
      }

      const user = auth.currentUser;

      if (!user) {
        throw new Error('Please sign in again to finish registration.');
      }

      const pending = readPending();

      if (!pending || pending.uid !== user.uid) {
        throw new Error(
          'Registration details are missing. Please start registration again.'
        );
      }

      await reload(user);

      if (!user.emailVerified) {
        throw new Error('Your email is not verified yet.');
      }

      await user.getIdToken(true);

      const result = await registerCompany({
        companyName: pending.companyName,
        ownerName: pending.ownerName,
      });

      if (!result.data.success) {
        throw new Error('Company registration was not completed.');
      }

      sessionStorage.removeItem(STORAGE_KEY);
      window.location.assign('/app');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to complete request.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function resendVerification() {
    setError('');
    setMessage('');

    try {
      const user = auth.currentUser;

      if (!user) {
        throw new Error('Please sign in again.');
      }

      await sendEmailVerification(user);
      setMessage('Another verification email has been sent.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to resend email.'
      );
    }
  }

  async function startOver() {
    try {
      await signOut(auth);
      sessionStorage.removeItem(STORAGE_KEY);
      setPassword('');
      setCompanyName('');
      setOwnerName('');
      changeMode('login');
    } catch {
      setError('Unable to sign out. Please try again.');
    }
  }

  if (!authReady) {
    return <main style={{ padding: 32 }}>Checking your session...</main>;
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#f6f7f9',
        padding: 24,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#fff',
          padding: 36,
          borderRadius: 16,
          boxShadow: '0 12px 40px rgba(0,0,0,0.07)',
        }}
      >
        <a href="/">
          <img
            src="/orvex-wordmark.png"
            alt="ORVEX"
            style={{ width: 170, marginBottom: 28 }}
          />
        </a>

        <h1 style={{ fontSize: 26, marginBottom: 8 }}>
          {mode === 'login'
            ? 'Sign In'
            : mode === 'register'
              ? 'Create Company Account'
              : 'Verify Your Email'}
        </h1>

        <p style={{ color: '#666', marginBottom: 28 }}>
          {mode === 'login'
            ? 'Access your ORVEX workspace.'
            : mode === 'register'
              ? 'Set up your company workspace.'
              : 'Confirm your email before activating your company.'}
        </p>

        {mode === 'register' && (
          <>
            <label htmlFor="companyName">Company Name</label>
            <input
              id="companyName"
              required
              minLength={2}
              maxLength={120}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              style={inputStyle}
            />

            <label htmlFor="ownerName">Your Full Name</label>
            <input
              id="ownerName"
              required
              minLength={2}
              maxLength={120}
              autoComplete="name"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              style={inputStyle}
            />
          </>
        )}

        {mode !== 'verify' && (
          <>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />

            <label htmlFor="password">Password</label>
            <div style={{ position: 'relative', margin: '8px 0 18px' }}>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              autoComplete={
                mode === 'register' ? 'new-password' : 'current-password'
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ ...inputStyle, margin: 0, paddingRight: 48 }}
            />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-controls="password"
                onClick={() => setShowPassword(visible => !visible)}
                style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 40, height: 36, display: 'grid', placeItems: 'center', border: 0, borderRadius: 6, background: 'transparent', color: '#475467', cursor: 'pointer' }}
              >
                {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
              </button>
            </div>
          </>
        )}

        {error && (
          <p role="alert" style={{ color: '#b42318', marginBottom: 16 }}>
            {error}
          </p>
        )}

        {message && (
          <p role="status" style={{ color: '#175cd3', marginBottom: 16 }}>
            {message}
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
          {loading
            ? 'Please Wait...'
            : mode === 'login'
              ? 'Sign In'
              : mode === 'register'
                ? 'Create Account'
                : 'I Verified My Email'}
        </button>

        {mode === 'verify' ? (
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <button type="button" onClick={resendVerification}>
              Resend Verification Email
            </button>
            <p>
              <button type="button" onClick={startOver}>
                Back to Sign In
              </button>
            </p>
          </div>
        ) : (mode !== 'login' || signupEnabled) ? (
          <p style={{ marginTop: 24, textAlign: 'center' }}>
            {mode === 'login'
              ? "Don't have a company account? "
              : 'Already have an account? '}
            <button
              type="button"
              onClick={() =>
                changeMode(mode === 'login' ? 'register' : 'login')
              }
              style={{
                border: 0,
                background: 'none',
                color: '#175cd3',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {mode === 'login' ? 'Create Company' : 'Sign In'}
            </button>
          </p>
        ) : null}
      </form>
    </main>
  );
}

