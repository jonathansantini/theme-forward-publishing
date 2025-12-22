import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from '@shopify/polaris';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import CreateSchedule from './pages/CreateSchedule';
import EditSchedule from './pages/EditSchedule';
import Settings from './pages/Settings';

/**
 * App component - Now using new unified App Bridge
 *
 * App Bridge is automatically initialized via the script tag in index.html
 * and the shopify-api-key meta tag. No need for AppBridgeProvider wrapper.
 *
 * The global `shopify` variable is available for App Bridge features like:
 * - shopify.toast.show()
 * - shopify.modal.show()
 * - shopify.resourcePicker()
 * etc.
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
    </ErrorBoundary>
  );
}

export default App;
