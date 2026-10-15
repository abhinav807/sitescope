import React from 'react';
import { createRoot } from 'react-dom/client';
import PopupApp from '../popup/PopupApp';
import '../styles/global.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>,
);
