import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Page, Layout, Banner, Spinner, Card, Text } from '@shopify/polaris';
import ScheduleForm from '../components/ScheduleForm';
import { useSchedule, useSchedules } from '../hooks/useSchedules';

function EditSchedule() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { schedule, loading } = useSchedule(id);
  const { updateSchedule } = useSchedules();

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (scheduleData) => {
    setError(null);

    try {
      await updateSchedule(id, scheduleData);

      setSuccess(true);

      // Navigate back to dashboard after a brief delay
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (err) {
      console.error('Update schedule error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to update schedule');
    }
  };

  const handleCancel = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <Page title="Edit Schedule" breadcrumbs={[{ content: 'Schedules', url: '/' }]}>
        <Layout>
          <Layout.Section>
            <Card>
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <Spinner size="large" />
                <Text as="p" variant="bodyMd">
                  Loading schedule...
                </Text>
              </div>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  if (!schedule) {
    return (
      <Page title="Edit Schedule" breadcrumbs={[{ content: 'Schedules', url: '/' }]}>
        <Layout>
          <Layout.Section>
            <Banner status="critical">
              <p>Schedule not found</p>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  if (schedule.finalized) {
    return (
      <Page title="Edit Schedule" breadcrumbs={[{ content: 'Schedules', url: '/' }]}>
        <Layout>
          <Layout.Section>
            <Banner status="warning">
              <p>
                This schedule is finalized and cannot be edited. Please unpublish it
                first from the dashboard.
              </p>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      title="Edit Schedule"
      breadcrumbs={[{ content: 'Schedules', url: '/' }]}
    >
      <Layout>
        {error && (
          <Layout.Section>
            <Banner status="critical" onDismiss={() => setError(null)}>
              <p>{error}</p>
            </Banner>
          </Layout.Section>
        )}

        {success && (
          <Layout.Section>
            <Banner status="success">
              <p>Schedule updated successfully! Redirecting...</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <Text as="h2" variant="headingMd">
              Schedule Info
            </Text>
            <div style={{ marginTop: '16px' }}>
              <Text as="p" variant="bodyMd">
                <strong>Section:</strong> {schedule.sectionId}
              </Text>
              <Text as="p" variant="bodyMd">
                <strong>Template:</strong> {schedule.templateName}
              </Text>
              <Text as="p" variant="bodyMd">
                <strong>Theme ID:</strong> {schedule.themeId}
              </Text>
            </div>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <ScheduleForm
            initialData={schedule}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            submitLabel="Update Schedule"
          />
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export default EditSchedule;
