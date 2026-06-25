import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const savedColor = localStorage.getItem('hexamess-primary-color') || '#dc2626';
document.documentElement.style.setProperty('--primary-color', savedColor);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
