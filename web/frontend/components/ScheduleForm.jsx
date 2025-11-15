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
    action: initialData?.action || 'hide',
    executeAt: initialData?.executeAt || '',
    recurrenceEnabled: initialData?.recurrence?.enabled || false,
    recurrenceType: initialData?.recurrence?.type || 'daily',
    recurrenceDayOfWeek: initialData?.recurrence?.dayOfWeek || 0,
    recurrenceDayOfMonth: initialData?.recurrence?.dayOfMonth || 1,
    recurrenceTime: initialData?.recurrence?.time || '00:00',
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

    if (!formData.executeAt) {
      newErrors.executeAt = 'Execution date and time is required';
    } else {
      const executeDate = new Date(formData.executeAt);
      if (isNaN(executeDate.getTime())) {
        newErrors.executeAt = 'Invalid date format';
      } else if (executeDate <= new Date()) {
        newErrors.executeAt = 'Execution time must be in the future';
      }
    }

    if (formData.recurrenceEnabled) {
      if (formData.recurrenceType === 'weekly') {
        if (
          formData.recurrenceDayOfWeek < 0 ||
          formData.recurrenceDayOfWeek > 6
        ) {
          newErrors.recurrenceDayOfWeek = 'Day of week must be between 0-6';
        }
      }

      if (formData.recurrenceType === 'monthly') {
        if (
          formData.recurrenceDayOfMonth < 1 ||
          formData.recurrenceDayOfMonth > 31
        ) {
          newErrors.recurrenceDayOfMonth = 'Day of month must be between 1-31';
        }
      }

      if (!formData.recurrenceTime || !/^\d{2}:\d{2}$/.test(formData.recurrenceTime)) {
        newErrors.recurrenceTime = 'Time must be in HH:mm format';
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
        action: formData.action,
        executeAt: formData.executeAt,
        recurrence: formData.recurrenceEnabled
          ? {
              enabled: true,
              type: formData.recurrenceType,
              dayOfWeek: formData.recurrenceDayOfWeek,
              dayOfMonth: formData.recurrenceDayOfMonth,
              time: formData.recurrenceTime,
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

        <Select
          label="Action"
          options={actionOptions}
          value={formData.action}
          onChange={handleChange('action')}
          helpText="Choose whether to show or hide the section"
        />

        <TextField
          label="Execution Date & Time"
          type="datetime-local"
          value={formData.executeAt}
          onChange={handleChange('executeAt')}
          error={errors.executeAt}
          helpText="When should this schedule execute?"
        />

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
                label="Day of Week"
                options={dayOfWeekOptions}
                value={String(formData.recurrenceDayOfWeek)}
                onChange={(value) =>
                  handleChange('recurrenceDayOfWeek')(parseInt(value))
                }
                error={errors.recurrenceDayOfWeek}
              />
            )}

            {formData.recurrenceType === 'monthly' && (
              <TextField
                label="Day of Month"
                type="number"
                value={String(formData.recurrenceDayOfMonth)}
                onChange={(value) =>
                  handleChange('recurrenceDayOfMonth')(parseInt(value))
                }
                error={errors.recurrenceDayOfMonth}
                min={1}
                max={31}
              />
            )}

            <TextField
              label="Time"
              type="time"
              value={formData.recurrenceTime}
              onChange={handleChange('recurrenceTime')}
              error={errors.recurrenceTime}
              helpText="Time of day for recurring schedules (HH:mm format)"
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
