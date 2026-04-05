import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from '@shopify/polaris';
import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import CreateSchedule from './pages/CreateSchedule';
import EditSchedule from './pages/EditSchedule';
import Settings from './pages/Settings';

/**
 * App component - Using unified App Bridge
 *
 * App Bridge is initialized via:
 * 1. Script tag in index.html
 * 2. shopify-api-key meta tag
 * 3. Provider wrapper for React hooks
 */
function App() {
  // Verify App Bridge is loaded
  if (typeof shopify === 'undefined') {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h1>App Bridge Not Loaded</h1>
        <p>
          The Shopify App Bridge script failed to load. Please check your internet connection
          and ensure the app is being accessed through the Shopify admin.
        </p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <AppBridgeProvider config={shopify.config}>
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
    </ErrorBoundary>
  );
}

export default App;
