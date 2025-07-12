// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // Tailwind CSSを読み込むためのファイル

console.log("main.tsx: Script execution started.");

const rootElement = document.getElementById('root');

if (rootElement) {
  console.log("main.tsx: Found root element. Rendering React app...");
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  console.log("main.tsx: React app rendered.");
} else {
  console.error("main.tsx: Fatal error - #root element not found in index.html. App cannot be mounted.");
}
