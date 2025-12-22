import React from 'react';
import { Banner, Page, Layout, TextContainer, Heading } from '@shopify/polaris';

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing.
 *
 * Usage:
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details to console
    console.error('Error Boundary caught an error:', error, errorInfo);

    // You can also log the error to an error reporting service here
    // Example: logErrorToService(error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Show toast notification if App Bridge is available
    if (typeof shopify !== 'undefined' && shopify.toast) {
      shopify.toast.show('An error occurred. Please try refreshing the page.', {
        isError: true,
      });
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Page>
          <Layout>
            <Layout.Section>
              <Banner
                title="Something went wrong"
                status="critical"
                action={{
                  content: 'Try again',
                  onAction: this.handleReset,
                }}
              >
                <p>
                  We're sorry, but something unexpected happened. Please try refreshing the page
                  or contact support if the problem persists.
                </p>
              </Banner>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div style={{ marginTop: '20px' }}>
                  <TextContainer>
                    <Heading>Error Details (Development Mode)</Heading>
                    <div
                      style={{
                        background: '#f4f4f4',
                        padding: '16px',
                        borderRadius: '4px',
                        overflow: 'auto',
                        marginTop: '12px',
                      }}
                    >
                      <pre style={{ margin: 0, fontSize: '12px' }}>
                        {this.state.error.toString()}
                        {'\n\n'}
                        {this.state.errorInfo?.componentStack}
                      </pre>
                    </div>
                  </TextContainer>
                </div>
              )}
            </Layout.Section>
          </Layout>
        </Page>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
