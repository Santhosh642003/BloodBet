// Remove <StrictMode> wrapper
import { createRoot } from 'react-dom/client';
import { SpacetimeProvider } from './app/context/SpacetimeContext';
import { SoundProvider } from './app/context/SoundContext';
import App from './app/App';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <SpacetimeProvider>
    <SoundProvider>
      <App />
    </SoundProvider>
  </SpacetimeProvider>
);