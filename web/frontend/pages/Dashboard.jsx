import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Page,
  Layout,
  Card,
  EmptyState,
  Spinner,
  Banner,
  ResourceList,
  ResourceItem,
  Text,
  Badge,
  ButtonGroup,
  Button,
  Tabs,
} from '@shopify/polaris';
import { useSchedules } from '../hooks/useSchedules';
import { useTimezone } from '../hooks/useTimezone';

function Dashboard() {
  const navigate = useNavigate();
  const { schedules, loading, error, deleteSchedule, finalizeSchedule, unpublishSchedule } =
    useSchedules();
  const { formatDate, getRelativeTime } = useTimezone();
  const [selectedTab, setSelectedTab] = useState(0);

  const handleCreateSchedule = () => {
    navigate('/schedules/new');
  };

  const handleEditSchedule = (id) => {
    navigate(`/schedules/${id}/edit`);
  };

  const handleDeleteSchedule = async (id) => {
    if (confirm('Are you sure you want to delete this schedule?')) {
      try {
        await deleteSchedule(id);
      } catch (error) {
        alert(`Failed to delete schedule: ${error.message}`);
      }
    }
  };

  const handleFinalizeSchedule = async (id) => {
    if (
      confirm(
        'Publish this schedule? You will not be able to edit it unless you unpublish it first.'
      )
    ) {
      try {
        await finalizeSchedule(id);
      } catch (error) {
        alert(`Failed to publish schedule: ${error.message}`);
      }
    }
  };

  const handleUnpublishSchedule = async (id) => {
    try {
      await unpublishSchedule(id);
    } catch (error) {
      alert(`Failed to unpublish schedule: ${error.message}`);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { status: 'info', label: 'Pending' },
      active: { status: 'attention', label: 'Active' },
      completed: { status: 'success', label: 'Completed' },
      failed: { status: 'critical', label: 'Failed' },
      cancelled: { status: 'default', label: 'Unpublished' },
    };

    const config = statusMap[status] || { status: 'default', label: status };
    return <Badge status={config.status}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <Page title="Section Scheduler">
        <Layout>
          <Layout.Section>
            <Card>
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <Spinner size="large" />
                <Text as="p" variant="bodyMd">
                  Loading schedules...
                </Text>
              </div>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  if (error) {
    return (
      <Page title="Section Scheduler">
        <Layout>
          <Layout.Section>
            <Banner status="critical">
              <p>Error loading schedules: {error}</p>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const emptyStateMarkup = (
    <EmptyState
      heading="Schedule your first section"
      action={{
        content: 'Create Schedule',
        onAction: handleCreateSchedule,
      }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>
        Create schedules to automatically show or hide theme sections at specific
        times.
      </p>
    </EmptyState>
  );

  // Filter schedules based on selected tab
  const tabs = [
    { id: 'all', content: 'All', filter: () => true },
    { id: 'active', content: 'Active', filter: (s) => s.status === 'active' },
    { id: 'pending', content: 'Pending', filter: (s) => s.status === 'pending' },
    { id: 'completed', content: 'Completed', filter: (s) => s.status === 'completed' },
  ];

  const filteredSchedules = schedules
    .filter(tabs[selectedTab].filter)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Newest first

  return (
    <Page
      title="Section Scheduler"
      primaryAction={{
        content: 'Create Schedule',
        onAction: handleCreateSchedule,
      }}
    >
      <Layout>
        <Layout.Section>
          {schedules.length === 0 ? (
            <Card>{emptyStateMarkup}</Card>
          ) : (
            <Card>
              <Tabs
                tabs={tabs}
                selected={selectedTab}
                onSelect={setSelectedTab}
              />
              <div style={{ marginTop: '16px' }}>
                <ResourceList
                  resourceName={{ singular: 'schedule', plural: 'schedules' }}
                  items={filteredSchedules}
                renderItem={(schedule) => {
                  const {
                    id,
                    name,
                    sectionId,
                    templateName,
                    action,
                    executeAt,
                    startTime,
                    endTime,
                    status,
                    recurrence,
                    finalized,
                    blockIds,
                  } = schedule;

                  // Determine if scheduling blocks or entire section
                  const isBlockLevel = blockIds && blockIds.length > 0;
                  const target = isBlockLevel
                    ? `${blockIds.length} block${blockIds.length !== 1 ? 's' : ''} in ${sectionId}`
                    : sectionId;

                  // Format time display based on whether we have start/end times or just executeAt
                  let timeDisplay;
                  if (startTime && endTime) {
                    // New format: show time range
                    const startFormatted = formatDate(startTime);
                    const endFormatted = formatDate(endTime);

                    // Check if dates are on the same day
                    const startDate = new Date(startTime);
                    const endDate = new Date(endTime);
                    const sameDay = startDate.toDateString() === endDate.toDateString();

                    if (sameDay) {
                      // Same day: show full date for start, only time for end
                      const endTimeOnly = endFormatted.split(', ').pop();
                      timeDisplay = `${startFormatted} - ${endTimeOnly}`;
                    } else {
                      // Different days: show full date for both
                      timeDisplay = `${startFormatted} - ${endFormatted}`;
                    }
                  } else {
                    // Legacy format: show single time with relative
                    timeDisplay = `${formatDate(executeAt)} (${getRelativeTime(executeAt)})`;
                  }

                  return (
                    <ResourceItem
                      id={id}
                      onClick={() => !finalized && handleEditSchedule(id)}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'start',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Text as="h3" variant="headingSm" fontWeight="semibold">
                              {name || `${action === 'hide' ? 'Hide' : 'Show'} ${target}`}
                            </Text>
                            {status === 'active' && (
                              <Badge status="attention">Active Now</Badge>
                            )}
                            {finalized && status === 'pending' && (
                              <Badge status="info">Pending</Badge>
                            )}
                            {status === 'completed' && (
                              <Badge status="success">Completed</Badge>
                            )}
                          </div>
                          <Text as="p" variant="bodySm" color="subdued">
                            Type: {action === 'hide' ? 'Hide' : 'Show'}
                          </Text>
                          <Text as="p" variant="bodySm" color="subdued">
                            Template: {templateName}
                          </Text>
                          {isBlockLevel && (
                            <Text as="p" variant="bodySm" color="subdued">
                              Block IDs: {blockIds.join(', ')}
                            </Text>
                          )}
                          <Text as="p" variant="bodySm">
                            {timeDisplay}
                          </Text>
                          {recurrence?.enabled && (
                            <Text as="p" variant="bodySm" color="subdued">
                              Recurring: {recurrence.type}
                            </Text>
                          )}
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            gap: '8px',
                            alignItems: 'center',
                          }}
                        >
                          {!finalized && getStatusBadge(status)}
                          {finalized && <Badge status="success">Published</Badge>}
                          <ButtonGroup>
                            {!finalized && (
                              <Button
                                size="slim"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditSchedule(id);
                                }}
                              >
                                Edit
                              </Button>
                            )}
                            {!finalized && (
                              <Button
                                size="slim"
                                tone="critical"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteSchedule(id);
                                }}
                              >
                                Delete
                              </Button>
                            )}
                            {!finalized && (
                              <Button
                                size="slim"
                                variant="primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFinalizeSchedule(id);
                                }}
                              >
                                Publish
                              </Button>
                            )}
                            {finalized && (
                              <Button
                                size="slim"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUnpublishSchedule(id);
                                }}
                              >
                                Unpublish
                              </Button>
                            )}
                          </ButtonGroup>
                        </div>
                      </div>
                    </ResourceItem>
                  );
                }}
              />
              </div>
            </Card>
          )}
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <Text as="h2" variant="headingMd">
              Quick Stats
            </Text>
            <div style={{ marginTop: '16px' }}>
              <Text as="p" variant="bodyMd">
                <strong>Total Schedules:</strong> {schedules.length}
              </Text>
              <Text as="p" variant="bodyMd">
                <strong>Pending:</strong>{' '}
                {schedules.filter((s) => s.status === 'pending').length}
              </Text>
              <Text as="p" variant="bodyMd">
                <strong>Active:</strong>{' '}
                {schedules.filter((s) => s.status === 'active').length}
              </Text>
              <Text as="p" variant="bodyMd">
                <strong>Completed:</strong>{' '}
                {schedules.filter((s) => s.status === 'completed').length}
              </Text>
              <Text as="p" variant="bodyMd">
                <strong>Failed:</strong>{' '}
                {schedules.filter((s) => s.status === 'failed').length}
              </Text>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export default Dashboard;
