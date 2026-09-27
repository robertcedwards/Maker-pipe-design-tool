import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/app.css';
import { useStore } from './state/store';

// Handy for poking at the design from the dev tools console.
if (import.meta.env.DEV) (window as unknown as { pfd: typeof useStore }).pfd = useStore;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
