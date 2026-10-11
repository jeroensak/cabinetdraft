import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { App } from './app/App'
import { AppAnalytics } from './app/AppAnalytics'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <AppAnalytics />
    </BrowserRouter>
  </StrictMode>,
)
