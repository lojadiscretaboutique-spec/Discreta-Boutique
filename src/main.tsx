import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { FeedbackProvider } from './contexts/FeedbackContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <FeedbackProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </FeedbackProvider>
    </BrowserRouter>
  </StrictMode>
);
