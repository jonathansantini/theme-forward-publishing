import { Page, Layout, Card, Text, Banner } from '@shopify/polaris';
import { useTimezone } from '../hooks/useTimezone';

function Settings() {
  const { shopInfo, shopTimezone, loading } = useTimezone();

  return (
    <Page
      title="Settings"
      breadcrumbs={[{ content: 'Dashboard', url: '/' }]}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <Text as="h2" variant="headingMd">
              Shop Information
            </Text>

            {loading ? (
              <Text as="p" variant="bodyMd">
                Loading...
              </Text>
            ) : (
              <div style={{ marginTop: '16px' }}>
                <Text as="p" variant="bodyMd">
                  <strong>Shop Name:</strong> {shopInfo?.name || 'N/A'}
                </Text>
                <Text as="p" variant="bodyMd">
                  <strong>Email:</strong> {shopInfo?.email || 'N/A'}
                </Text>
                <Text as="p" variant="bodyMd">
                  <strong>Timezone:</strong> {shopTimezone}
                </Text>
                <Text as="p" variant="bodyMd">
                  <strong>Currency:</strong> {shopInfo?.currencyCode || 'N/A'}
                </Text>
              </div>
            )}
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <Text as="h2" variant="headingMd">
              About Section Scheduler
            </Text>
            <div style={{ marginTop: '16px' }}>
              <Text as="p" variant="bodyMd">
                Version: 1.0.0 (MVP)
              </Text>
              <Text as="p" variant="bodyMd">
                This app allows you to schedule theme sections to show or hide at
                specific times with recurring schedule support.
              </Text>
            </div>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Banner>
            <p>
              <strong>Important:</strong> All schedules run according to your
              store's timezone ({shopTimezone}). Make sure to account for this when
              creating schedules.
            </p>
          </Banner>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <Text as="h2" variant="headingMd">
              How It Works
            </Text>
            <div style={{ marginTop: '16px' }}>
              <ol>
                <li>
                  <Text as="p" variant="bodyMd">
                    Select a template and section from your published theme
                  </Text>
                </li>
                <li>
                  <Text as="p" variant="bodyMd">
                    Choose whether to show or hide the section
                  </Text>
                </li>
                <li>
                  <Text as="p" variant="bodyMd">
                    Set when the change should happen
                  </Text>
                </li>
                <li>
                  <Text as="p" variant="bodyMd">
                    Optionally set up recurring schedules (daily, weekly, monthly)
                  </Text>
                </li>
                <li>
                  <Text as="p" variant="bodyMd">
                    The app automatically applies changes at the scheduled time
                  </Text>
                </li>
              </ol>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export default Settings;
