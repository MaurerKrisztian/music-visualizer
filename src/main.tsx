import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { prepareDownloads } from './export/settings';
import './styles.css';

void prepareDownloads();

createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);
