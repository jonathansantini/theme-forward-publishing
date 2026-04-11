/**
 * ScheduleForm Component Tests
 *
 * Tests form validation and user interactions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock isomorphic-dompurify to avoid ES module issues
vi.mock('isomorphic-dompurify', () => ({
  default: {
    sanitize: (dirty) => {
      if (typeof dirty !== 'string') return '';
      return dirty.replace(/<[^>]*>/g, '');
    },
  },
}));

// Mock Polaris AppProvider
vi.mock('@shopify/polaris', async () => {
  const actual = await vi.importActual('@shopify/polaris');
  return {
    ...actual,
    AppProvider: ({ children }) => children,
  };
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScheduleForm from '../components/ScheduleForm';

// Mock timezone hook
vi.mock('../hooks/useTimezone', () => ({
  useTimezone: () => ({
    shopTimezone: 'America/New_York',
    formatDate: (date) => new Date(date).toLocaleString(),
  }),
}));

describe('ScheduleForm', () => {
  let mockOnSubmit;
  let mockOnCancel;
  let user;

  beforeEach(() => {
    mockOnSubmit = vi.fn().mockResolvedValue(undefined);
    mockOnCancel = vi.fn();
    user = userEvent.setup();
  });

  it('should render form fields', () => {
    render(<ScheduleForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    expect(screen.getByLabelText(/schedule name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/action/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start date & time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/end date & time/i)).toBeInTheDocument();
  });

  it('should validate required fields', async () => {
    render(<ScheduleForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    const submitButton = screen.getByRole('button', { name: /create schedule/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/start date and time is required/i)).toBeInTheDocument();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('should allow end time to be optional', async () => {
    render(<ScheduleForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    const startTimeInput = screen.getByLabelText(/start date & time/i);
    await user.type(startTimeInput, '2026-04-15T10:00');

    const submitButton = screen.getByRole('button', { name: /create schedule/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          startTime: '2026-04-15T10:00',
          endTime: undefined,
        })
      );
    });
  });

  it('should sanitize schedule name input', async () => {
    render(<ScheduleForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    const nameInput = screen.getByLabelText(/schedule name/i);
    const startTimeInput = screen.getByLabelText(/start date & time/i);

    // Try to inject HTML
    await user.type(nameInput, '<script>alert("xss")</script>Test');
    await user.type(startTimeInput, '2026-04-15T10:00');

    const submitButton = screen.getByRole('button', { name: /create schedule/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test', // HTML stripped
        })
      );
    });
  });

  it('should show recurrence fields when enabled', async () => {
    render(<ScheduleForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    const recurrenceCheckbox = screen.getByLabelText(/make this a recurring schedule/i);
    await user.click(recurrenceCheckbox);

    await waitFor(() => {
      expect(screen.getByLabelText(/recurrence type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/start time/i)).toBeInTheDocument();
    });
  });

  it('should call onCancel when cancel button is clicked', async () => {
    render(<ScheduleForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should populate form with initial data when editing', () => {
    const initialData = {
      name: 'Existing Schedule',
      action: 'show',
      startTime: '2026-04-15T10:00',
      endTime: '2026-04-15T12:00',
    };

    render(
      <ScheduleForm
        initialData={initialData}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        submitLabel="Update Schedule"
      />
    );

    expect(screen.getByDisplayValue('Existing Schedule')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-04-15T10:00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-04-15T12:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update schedule/i })).toBeInTheDocument();
  });
});
