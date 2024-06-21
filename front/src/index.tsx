import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { SnackbarProvider } from 'notistack';

console.log(`Environment: ${process.env.NODE_ENV}`);
var backend='http://localhost:3883';
if ( process.env.NODE_ENV==='production') backend=window.location.protocol+'//'+window.location.host;
console.log(`API backend to use: ${backend}`);

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode >
      <SnackbarProvider>
        <App />
      </SnackbarProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
