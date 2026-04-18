/**
 * SectionPicker Component Tests
 *
 * Tests theme selection, template labeling, and section picking.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

vi.mock('@shopify/polaris', async () => {
  const actual = await vi.importActual('@shopify/polaris');
  return {
    ...actual,
    AppProvider: ({ children }) => children,
    // Wrap components that internally call useI18n so they render without AppProvider context
    Banner: ({ children }) => <div data-testid="banner">{children}</div>,
    Select: ({ label, options, value, onChange, disabled, helpText }) => (
      <div>
        <label htmlFor={`select-${label}`}>{label}</label>
        <select
          id={`select-${label}`}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          aria-label={label}
        >
          {options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {helpText && <span>{helpText}</span>}
      </div>
    ),
    ResourceList: ({ items, renderItem }) => (
      <ul>{items?.map((item) => renderItem(item))}</ul>
    ),
    ResourceItem: ({ children, onClick, id }) => (
      <li key={id} onClick={onClick}>{children}</li>
    ),
    Badge: ({ children }) => <span>{children}</span>,
    Spinner: ({ size }) => <div aria-label="loading">Loading...</div>,
    Card: ({ children }) => <div>{children}</div>,
    FormLayout: ({ children }) => <div>{children}</div>,
    Text: ({ children }) => <span>{children}</span>,
  };
});

const mockUseAllThemes = vi.fn();
const mockUseTemplates = vi.fn();
const mockUseSections = vi.fn();

vi.mock('../hooks/useThemes', () => ({
  useAllThemes: () => mockUseAllThemes(),
  useTemplates: (...args) => mockUseTemplates(...args),
  useSections: (...args) => mockUseSections(...args),
}));

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SectionPicker from '../components/SectionPicker';

const MOCK_THEMES = [
  { id: 'gid://shopify/OnlineStoreTheme/1', name: 'Dawn', role: 'MAIN' },
  { id: 'gid://shopify/OnlineStoreTheme/2', name: 'Refresh', role: 'UNPUBLISHED' },
];

const MOCK_TEMPLATES = [
  { filename: 'index.json', fullPath: 'templates/index.json' },
  { filename: 'collection.json', fullPath: 'templates/collection.json' },
  { filename: 'product.json', fullPath: 'templates/product.json' },
  { filename: 'page.contact.json', fullPath: 'templates/page.contact.json' },
];

const MOCK_SECTIONS = {
  sections: {
    hero: { type: 'image-banner' },
    'featured-collection': { type: 'featured-collection' },
  },
};

beforeEach(() => {
  mockUseAllThemes.mockReturnValue({ themes: MOCK_THEMES, loading: false, error: null });
  mockUseTemplates.mockReturnValue({ templates: MOCK_TEMPLATES, loading: false, error: null });
  mockUseSections.mockReturnValue({ sections: null, loading: false, error: null });
});

describe('SectionPicker', () => {
  it('should show a loading spinner while themes load', () => {
    mockUseAllThemes.mockReturnValueOnce({ themes: [], loading: true, error: null });
    render(<SectionPicker />);
    expect(screen.getByText('Loading themes...')).toBeInTheDocument();
  });

  it('should render a theme dropdown with all themes', () => {
    render(<SectionPicker />);
    expect(screen.getByLabelText(/theme/i)).toBeInTheDocument();
    expect(screen.getByText('Dawn (Published)')).toBeInTheDocument();
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('should label known templates with human-readable names', () => {
    render(<SectionPicker />);
    expect(screen.getByText('Homepage')).toBeInTheDocument();
    expect(screen.getByText('Collections')).toBeInTheDocument();
    expect(screen.getByText('Products')).toBeInTheDocument();
  });

  it('should fall back to title-cased name for custom templates', () => {
    render(<SectionPicker />);
    // page.contact.json → "Page Contact"
    expect(screen.getByText('Page Contact')).toBeInTheDocument();
  });

  it('should call onSelect with new themeId when theme changes', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<SectionPicker onSelect={onSelect} />);

    const themeSelect = screen.getByLabelText(/theme/i);
    await user.selectOptions(themeSelect, 'gid://shopify/OnlineStoreTheme/2');

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        themeId: 'gid://shopify/OnlineStoreTheme/2',
        templateName: '',
        sectionId: '',
      })
    );
  });

  it('should reset template and section when theme changes', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <SectionPicker
        onSelect={onSelect}
        selectedThemeId="gid://shopify/OnlineStoreTheme/1"
        selectedTemplate="index.json"
        selectedSection="hero"
      />
    );

    const themeSelect = screen.getByLabelText(/theme/i);
    await user.selectOptions(themeSelect, 'gid://shopify/OnlineStoreTheme/2');

    expect(onSelect).toHaveBeenCalledWith({
      themeId: 'gid://shopify/OnlineStoreTheme/2',
      templateName: '',
      sectionId: '',
    });
  });

  it('should show sections after a template is selected', async () => {
    const user = userEvent.setup();
    mockUseSections.mockReturnValue({ sections: MOCK_SECTIONS, loading: false, error: null });

    render(<SectionPicker selectedThemeId="gid://shopify/OnlineStoreTheme/1" />);

    const templateSelect = screen.getByLabelText(/template/i);
    await user.selectOptions(templateSelect, 'index.json');

    expect(screen.getByText('hero')).toBeInTheDocument();
    expect(screen.getByText('featured-collection')).toBeInTheDocument();
  });

  it('should show a warning when no themes are found', () => {
    mockUseAllThemes.mockReturnValueOnce({ themes: [], loading: false, error: null });
    render(<SectionPicker />);
    expect(screen.getByText(/no themes found/i)).toBeInTheDocument();
  });
});
