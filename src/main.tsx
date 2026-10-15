import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/fraunces/400.css';
import '@fontsource/fraunces/500.css';
import '@fontsource/fraunces/600.css';
import App from './App';
import './styles.css';
import { initializeStorage } from './lib/storage';
import { prepareInitialGift } from './lib/initial-gift';

async function start() {
  let storageAvailable = true;
  try { await initializeStorage(); await prepareInitialGift(); } catch { storageAvailable = false; }
  ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App storageAvailable={storageAvailable}/></React.StrictMode>);
}
void start();
