import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Page, Layout, Banner, Spinner, Card, Text, Button } from '@shopify/polaris';
import SectionPicker from '../components/SectionPicker';
import ScheduleForm from '../components/ScheduleForm';
import { useSchedule, useSchedules } from '../hooks/useSchedules';

function EditSchedule() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { schedule, loading } = useSchedule(id);
  const { updateSchedule, deleteSchedule } = useSchedules();

  const [selectedSection, setSelectedSection] = useState({
    themeId: null,
    templateName: null,
    sectionId: null,
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Initialize selected section from schedule data
  useEffect(() => {
    if (schedule) {
      setSelectedSection({
        themeId: schedule.themeId,
        templateName: schedule.templateName,
        sectionId: schedule.sectionId,
      });
    }
  }, [schedule]);

  const handleSectionSelect = (selection) => {
    setSelectedSection(selection);
    setError(null);
  };

  const handleSubmit = async (scheduleData) => {
    setError(null);

    // Validate section is selected
    if (!selectedSection.themeId || !selectedSection.templateName || !selectedSection.sectionId) {
      setError('Please select a theme, template, and section');
      return;
    }

    try {
      const fullScheduleData = {
        ...scheduleData,
        themeId: selectedSection.themeId,
        templateName: selectedSection.templateName,
        sectionId: selectedSection.sectionId,
      };

      await updateSchedule(id, fullScheduleData);

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

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this schedule?')) {
      try {
        await deleteSchedule(id);
        navigate('/');
      } catch (err) {
        console.error('Delete schedule error:', err);
        setError(err.response?.data?.error || err.message || 'Failed to delete schedule');
      }
    }
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
          <SectionPicker
            onSelect={handleSectionSelect}
            selectedThemeId={selectedSection.themeId}
            selectedTemplate={selectedSection.templateName}
            selectedSection={selectedSection.sectionId}
          />
        </Layout.Section>

        {selectedSection.sectionId && (
          <Layout.Section>
            <ScheduleForm
              initialData={schedule}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              submitLabel="Update Schedule"
            />
          </Layout.Section>
        )}

        {selectedSection.sectionId && (
          <Layout.Section>
            <Card>
              <Button
                tone="critical"
                onClick={handleDelete}
                fullWidth
              >
                Delete Schedule
              </Button>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}

export default EditSchedule;
