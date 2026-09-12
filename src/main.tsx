import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

function registerOfflineSupport() {
  const isProduction = (import.meta as ImportMeta & { env?: { PROD?: boolean } }).env?.PROD;
  if (!isProduction || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {
      // Offline support is additive; the app remains usable when a browser
      // blocks service workers or private browsing disables their storage.
    });
  }, { once: true });
}

// Lift the launch screen once the first real frame is on screen.
function dismissBoot() {
  const boot = document.getElementById('boot');
  if (!boot) return;
  requestAnimationFrame(() => {
    boot.classList.add('is-done');
    setTimeout(() => boot.remove(), 500);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

dismissBoot();
registerOfflineSupport();
