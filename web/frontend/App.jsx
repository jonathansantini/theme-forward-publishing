import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from '@shopify/polaris';
import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import Dashboard from './pages/Dashboard';
import CreateSchedule from './pages/CreateSchedule';
import EditSchedule from './pages/EditSchedule';
import Settings from './pages/Settings';

function App() {
  // Get shop and host from URL params
  const params = new URLSearchParams(window.location.search);
  const shop = params.get('shop');
  const host = params.get('host');

  // App Bridge config
  const config = {
    apiKey: import.meta.env.VITE_SHOPIFY_API_KEY || '',
    host: host || '',
    forceRedirect: true,
  };

  return (
    <AppBridgeProvider config={config}>
      <AppProvider
        i18n={{
          Polaris: {
            ResourceList: {
              sortingLabel: 'Sort by',
              defaultItemSingular: 'item',
              defaultItemPlural: 'items',
              showing: 'Showing {itemsCount} {resource}',
            },
            Common: {
              checkbox: 'checkbox',
            },
          },
        }}
      >
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/schedules/new" element={<CreateSchedule />} />
            <Route path="/schedules/:id/edit" element={<EditSchedule />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </AppBridgeProvider>
  );
}

export default App;
