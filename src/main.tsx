import {lazy,Suspense} from 'react';
const AccountPage=lazy(()=>import('./auth/AccountPage'));
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{location.pathname.startsWith('/account')?<Suspense fallback={<p role="status">Loading account…</p>}><AccountPage/></Suspense>:<App/>}</React.StrictMode>);

import './documents/documents.css';
