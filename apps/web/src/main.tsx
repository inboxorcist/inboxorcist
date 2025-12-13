import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/query-client'
import './index.css'
import App from './App.tsx'
import { LanguageProvider } from './hooks/useLanguage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
