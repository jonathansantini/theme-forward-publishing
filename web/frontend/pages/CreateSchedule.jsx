import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page, Layout, Banner } from '@shopify/polaris';
import SectionPicker from '../components/SectionPicker';
import ScheduleForm from '../components/ScheduleForm';
import { useSchedules } from '../hooks/useSchedules';

function CreateSchedule() {
  const navigate = useNavigate();
  const { createSchedule } = useSchedules();

  const [selectedSection, setSelectedSection] = useState({
    themeId: null,
    templateName: null,
    sectionId: null,
  });

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

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

      await createSchedule(fullScheduleData);

      setSuccess(true);

      // Navigate back to dashboard after a brief delay
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (err) {
      console.error('Create schedule error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to create schedule');
    }
  };

  const handleCancel = () => {
    navigate('/');
  };

  return (
    <Page
      title="Create Schedule"
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
              <p>Schedule created successfully! Redirecting...</p>
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
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              submitLabel="Create Schedule"
            />
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}

export default CreateSchedule;
