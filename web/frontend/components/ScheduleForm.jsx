import { useState } from 'react';
import {
  Card,
  FormLayout,
  TextField,
  Select,
  Checkbox,
  Button,
  ButtonGroup,
  Text,
  Banner,
} from '@shopify/polaris';
import { useTimezone } from '../hooks/useTimezone';

function ScheduleForm({ initialData, onSubmit, onCancel, submitLabel = 'Create Schedule' }) {
  const { shopTimezone, formatDate } = useTimezone();

  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    action: initialData?.action || 'hide',
    // Support both new format (startTime/endTime) and legacy format (executeAt)
    startTime: initialData?.startTime || initialData?.executeAt || '',
    endTime: initialData?.endTime || '',
    recurrenceEnabled: initialData?.recurrence?.enabled || false,
    recurrenceType: initialData?.recurrence?.type || 'daily',
    recurrenceDayOfWeek: initialData?.recurrence?.dayOfWeek || 0,
    recurrenceDayOfMonth: initialData?.recurrence?.dayOfMonth || 1,
    recurrenceTime: initialData?.recurrence?.time || '00:00',
    // New: recurring end time fields
    recurrenceEndTime: initialData?.recurrence?.endTime || '23:59',
    recurrenceEndDayOfWeek: initialData?.recurrence?.endDayOfWeek || 0,
    recurrenceEndDayOfMonth: initialData?.recurrence?.endDayOfMonth || 1,
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field) => (value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when field is changed
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const handleCheckboxChange = (field) => (value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    const newErrors = {};

    // Validate start time
    if (!formData.recurrenceEnabled) {
      // Non-recurring: validate startTime
      if (!formData.startTime) {
        newErrors.startTime = 'Start date and time is required';
      } else {
        const startDate = new Date(formData.startTime);
        if (isNaN(startDate.getTime())) {
          newErrors.startTime = 'Invalid date format';
        }
      }

      // Non-recurring: endTime is optional, but validate if provided
      if (formData.endTime) {
        const endDate = new Date(formData.endTime);
        if (isNaN(endDate.getTime())) {
          newErrors.endTime = 'Invalid date format';
        } else if (formData.startTime) {
          const startDate = new Date(formData.startTime);
          if (endDate <= startDate) {
            newErrors.endTime = 'End time must be after start time';
          }
        }
      }
    }

    // Validate recurring schedules
    if (formData.recurrenceEnabled) {
      if (formData.recurrenceType === 'weekly') {
        if (
          formData.recurrenceDayOfWeek < 0 ||
          formData.recurrenceDayOfWeek > 6
        ) {
          newErrors.recurrenceDayOfWeek = 'Day of week must be between 0-6';
        }
        if (
          formData.recurrenceEndDayOfWeek < 0 ||
          formData.recurrenceEndDayOfWeek > 6
        ) {
          newErrors.recurrenceEndDayOfWeek = 'End day of week must be between 0-6';
        }
      }

      if (formData.recurrenceType === 'monthly') {
        if (
          formData.recurrenceDayOfMonth < 1 ||
          formData.recurrenceDayOfMonth > 31
        ) {
          newErrors.recurrenceDayOfMonth = 'Day of month must be between 1-31';
        }
        if (
          formData.recurrenceEndDayOfMonth < 1 ||
          formData.recurrenceEndDayOfMonth > 31
        ) {
          newErrors.recurrenceEndDayOfMonth = 'End day of month must be between 1-31';
        }
      }

      if (!formData.recurrenceTime || !/^\d{2}:\d{2}$/.test(formData.recurrenceTime)) {
        newErrors.recurrenceTime = 'Start time must be in HH:mm format';
      }
      if (!formData.recurrenceEndTime || !/^\d{2}:\d{2}$/.test(formData.recurrenceEndTime)) {
        newErrors.recurrenceEndTime = 'End time must be in HH:mm format';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    setSubmitting(true);

    try {
      const scheduleData = {
        name: formData.name,
        action: formData.action,
        startTime: formData.startTime,
        endTime: formData.endTime || undefined, // Optional for non-recurring
        recurrence: formData.recurrenceEnabled
          ? {
              enabled: true,
              type: formData.recurrenceType,
              dayOfWeek: formData.recurrenceDayOfWeek,
              dayOfMonth: formData.recurrenceDayOfMonth,
              time: formData.recurrenceTime,
              endTime: formData.recurrenceEndTime,
              endDayOfWeek: formData.recurrenceEndDayOfWeek,
              endDayOfMonth: formData.recurrenceEndDayOfMonth,
            }
          : { enabled: false },
      };

      await onSubmit(scheduleData);
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const actionOptions = [
    { label: 'Hide section', value: 'hide' },
    { label: 'Show section', value: 'show' },
  ];

  const recurrenceTypeOptions = [
    { label: 'Daily', value: 'daily' },
    { label: 'Weekly', value: 'weekly' },
    { label: 'Monthly', value: 'monthly' },
  ];

  const dayOfWeekOptions = [
    { label: 'Sunday', value: '0' },
    { label: 'Monday', value: '1' },
    { label: 'Tuesday', value: '2' },
    { label: 'Wednesday', value: '3' },
    { label: 'Thursday', value: '4' },
    { label: 'Friday', value: '5' },
    { label: 'Saturday', value: '6' },
  ];

  return (
    <Card>
      <FormLayout>
        <Text as="h2" variant="headingMd">
          Schedule Details
        </Text>

        <Banner>
          <p>
            <strong>Store timezone:</strong> {shopTimezone}
          </p>
          <p>All times will be scheduled according to your store's timezone</p>
        </Banner>

        <TextField
          label="Schedule Name (optional)"
          value={formData.name}
          onChange={handleChange('name')}
          placeholder="e.g., Hide banner during maintenance"
          helpText="Give this schedule a memorable name"
        />

        <Select
          label="Action"
          options={actionOptions}
          value={formData.action}
          onChange={handleChange('action')}
          helpText="Choose whether to show or hide the section"
        />

        <TextField
          label="Start Date & Time"
          type="datetime-local"
          value={formData.startTime}
          onChange={handleChange('startTime')}
          error={errors.startTime}
          helpText="When should this action start?"
        />

        {!formData.recurrenceEnabled && (
          <TextField
            label="End Date & Time (optional)"
            type="datetime-local"
            value={formData.endTime}
            onChange={handleChange('endTime')}
            error={errors.endTime}
            helpText="When should this action end? Leave blank to run indefinitely."
          />
        )}

        <Checkbox
          label="Make this a recurring schedule"
          checked={formData.recurrenceEnabled}
          onChange={handleCheckboxChange('recurrenceEnabled')}
        />

        {formData.recurrenceEnabled && (
          <>
            <Select
              label="Recurrence Type"
              options={recurrenceTypeOptions}
              value={formData.recurrenceType}
              onChange={handleChange('recurrenceType')}
            />

            {formData.recurrenceType === 'weekly' && (
              <Select
                label="Start Day of Week"
                options={dayOfWeekOptions}
                value={String(formData.recurrenceDayOfWeek)}
                onChange={(value) =>
                  handleChange('recurrenceDayOfWeek')(parseInt(value))
                }
                error={errors.recurrenceDayOfWeek}
                helpText="Day of week to start the action"
              />
            )}

            {formData.recurrenceType === 'monthly' && (
              <TextField
                label="Start Day of Month"
                type="number"
                value={String(formData.recurrenceDayOfMonth)}
                onChange={(value) =>
                  handleChange('recurrenceDayOfMonth')(parseInt(value))
                }
                error={errors.recurrenceDayOfMonth}
                min={1}
                max={31}
                helpText="Day of month to start the action"
              />
            )}

            <TextField
              label="Start Time"
              type="time"
              value={formData.recurrenceTime}
              onChange={handleChange('recurrenceTime')}
              error={errors.recurrenceTime}
              helpText="Time of day to start the action"
            />

            {formData.recurrenceType === 'weekly' && (
              <Select
                label="End Day of Week"
                options={dayOfWeekOptions}
                value={String(formData.recurrenceEndDayOfWeek)}
                onChange={(value) =>
                  handleChange('recurrenceEndDayOfWeek')(parseInt(value))
                }
                error={errors.recurrenceEndDayOfWeek}
                helpText="Day of week to end the action"
              />
            )}

            {formData.recurrenceType === 'monthly' && (
              <TextField
                label="End Day of Month"
                type="number"
                value={String(formData.recurrenceEndDayOfMonth)}
                onChange={(value) =>
                  handleChange('recurrenceEndDayOfMonth')(parseInt(value))
                }
                error={errors.recurrenceEndDayOfMonth}
                min={1}
                max={31}
                helpText="Day of month to end the action"
              />
            )}

            <TextField
              label="End Time"
              type="time"
              value={formData.recurrenceEndTime}
              onChange={handleChange('recurrenceEndTime')}
              error={errors.recurrenceEndTime}
              helpText="Time of day to end the action (automatic reversal)"
            />
          </>
        )}

        <ButtonGroup>
          <Button onClick={onCancel}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={submitting}
          >
            {submitLabel}
          </Button>
        </ButtonGroup>
      </FormLayout>
    </Card>
  );
}

export default ScheduleForm;
