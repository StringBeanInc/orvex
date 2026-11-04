
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { onAuthStateChanged, type User } from 'firebase/auth';

import ProductionApp from './ProductionApp';
import LandingPage from './LandingPage';
import LoginPage from './LoginPage';
import { auth } from './firebase';

import './index.css';
import './documents/documents.css';

function ProtectedApp() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setChecking(false);
      },
      () => {
        setUser(null);
        setChecking(false);
      }
    );
  }, []);

  if (checking) {
    return <div style={{ padding: 32 }}>Checking your session...</div>;
  }

  if (!user) {
    window.location.replace('/account?mode=login');
    return null;
  }

  return <ProductionApp user={user} />;
}

function Router() {
  const path = window.location.pathname;

  if (path === '/') {
    return <LandingPage />;
  }

  if (path === '/account') {
    return <LoginPage />;
  }

  return <ProtectedApp />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>
);
