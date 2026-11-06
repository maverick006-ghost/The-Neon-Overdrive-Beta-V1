import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ThreeMFPrototype } from './components/ThreeMFPrototype';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('The application root element was not found.');

const application = window.location.pathname === '/3mf-test'
  ? <ThreeMFPrototype />
  : <App />;

createRoot(rootElement).render(application);
