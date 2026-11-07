import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { TooltipProvider } from '@radix-ui/react-tooltip'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TooltipProvider delayDuration={400}>
      <App />
    </TooltipProvider>
  </StrictMode>,
)