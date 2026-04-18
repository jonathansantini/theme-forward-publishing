import { useState, useEffect } from 'react';
import {
  Card,
  FormLayout,
  Select,
  ResourceList,
  ResourceItem,
  Text,
  Badge,
  Spinner,
  Banner,
} from '@shopify/polaris';
import { useAllThemes, useTemplates, useSections } from '../hooks/useThemes';

const TEMPLATE_LABELS = {
  'index.json': 'Homepage',
  'collection.json': 'Collections',
  'collections.json': 'Collections',
  'product.json': 'Products',
  'cart.json': 'Cart',
  'blog.json': 'Blog',
  'article.json': 'Blog Posts',
  'page.json': 'Pages',
  'search.json': 'Search',
  '404.json': 'Not Found (404)',
  'password.json': 'Password',
  'gift_card.liquid': 'Gift Card',
  'customers/account.json': 'Customer Account',
  'customers/login.json': 'Customer Login',
  'customers/register.json': 'Customer Register',
  'customers/order.json': 'Customer Order',
  'customers/addresses.json': 'Customer Addresses',
};

function getTemplateLabel(filename) {
  if (TEMPLATE_LABELS[filename]) return TEMPLATE_LABELS[filename];
  // Strip extension, replace separators with spaces, title-case each word
  return filename
    .replace(/\.(json|liquid)$/, '')
    .replace(/[._-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function SectionPicker({ onSelect, selectedThemeId, selectedTemplate, selectedSection }) {
  const { themes, loading: themesLoading } = useAllThemes();

  // Default selected theme: use prop if provided, otherwise use the MAIN theme once loaded
  const [localThemeId, setLocalThemeId] = useState(selectedThemeId || '');

  const { templates, loading: templatesLoading } = useTemplates(localThemeId);
  const { sections, loading: sectionsLoading } = useSections(localThemeId, selectedTemplate);

  const [localTemplate, setLocalTemplate] = useState(selectedTemplate || '');
  const [localSection, setLocalSection] = useState(selectedSection || '');

  // Once themes load, default to the published (MAIN) theme if nothing is selected yet
  useEffect(() => {
    if (!localThemeId && themes.length > 0) {
      const main = themes.find((t) => t.role === 'MAIN' || t.role === 'main') || themes[0];
      setLocalThemeId(main.id);
      onSelect?.({ themeId: main.id, templateName: localTemplate, sectionId: localSection });
    }
  }, [themes]);

  // Update local state when props change (e.g., when editing an existing schedule)
  useEffect(() => {
    if (selectedThemeId) setLocalThemeId(selectedThemeId);
  }, [selectedThemeId]);

  useEffect(() => {
    if (selectedTemplate) setLocalTemplate(selectedTemplate);
    if (selectedSection) setLocalSection(selectedSection);
  }, [selectedTemplate, selectedSection]);

  const handleThemeChange = (value) => {
    setLocalThemeId(value);
    setLocalTemplate('');
    setLocalSection('');
    onSelect?.({ themeId: value, templateName: '', sectionId: '' });
  };

  const handleTemplateChange = (value) => {
    setLocalTemplate(value);
    setLocalSection('');
    onSelect?.({ themeId: localThemeId, templateName: value, sectionId: '' });
  };

  const handleSectionClick = (sectionId) => {
    setLocalSection(sectionId);
    onSelect?.({ themeId: localThemeId, templateName: localTemplate, sectionId });
  };

  if (themesLoading) {
    return (
      <Card>
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <Spinner size="large" />
          <Text as="p" variant="bodyMd">
            Loading themes...
          </Text>
        </div>
      </Card>
    );
  }

  if (themes.length === 0) {
    return (
      <Card>
        <Banner status="warning">
          <p>No themes found</p>
        </Banner>
      </Card>
    );
  }

  const themeOptions = themes.map((t) => ({
    label: t.role === 'MAIN' || t.role === 'main' ? `${t.name} (Published)` : t.name,
    value: t.id,
  }));

  const templateOptions = [
    { label: 'Select a template', value: '' },
    ...templates.map((t) => ({
      label: getTemplateLabel(t.filename),
      value: t.filename,
    })),
  ];

  const sectionItems =
    sections && sections.sections
      ? Object.entries(sections.sections).map(([id, data]) => ({
          id,
          type: data.type || 'unknown',
        }))
      : [];

  return (
    <Card>
      <FormLayout>
        <Text as="h2" variant="headingMd">
          Select Section
        </Text>

        <Select
          label="Theme"
          options={themeOptions}
          value={localThemeId}
          onChange={handleThemeChange}
          helpText="You can schedule sections on any theme, including unpublished ones"
        />

        <Select
          label="Template"
          options={templateOptions}
          value={localTemplate}
          onChange={handleTemplateChange}
          disabled={templatesLoading || !localThemeId}
          helpText="Select the template containing the section you want to schedule"
        />

        {sectionsLoading && localTemplate && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spinner size="small" />
            <Text as="p" variant="bodyMd">
              Loading sections...
            </Text>
          </div>
        )}

        {!sectionsLoading && localTemplate && sectionItems.length > 0 && (
          <div>
            <Text as="p" variant="bodyMd" fontWeight="semibold">
              Sections in {getTemplateLabel(localTemplate)}
            </Text>
            <ResourceList
              resourceName={{ singular: 'section', plural: 'sections' }}
              items={sectionItems}
              renderItem={(item) => {
                const { id, type } = item;
                const isSelected = id === localSection;

                return (
                  <ResourceItem
                    id={id}
                    onClick={() => handleSectionClick(id)}
                    verticalAlignment="center"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <Text as="h3" variant="bodyMd" fontWeight="semibold">
                          {id}
                        </Text>
                        <Text as="p" variant="bodySm" color="subdued">
                          Type: {type}
                        </Text>
                      </div>
                      {isSelected && <Badge status="success">Selected</Badge>}
                    </div>
                  </ResourceItem>
                );
              }}
            />
          </div>
        )}

        {!sectionsLoading && localTemplate && sectionItems.length === 0 && (
          <Banner status="info">
            <p>No sections found in this template</p>
          </Banner>
        )}
      </FormLayout>
    </Card>
  );
}

export default SectionPicker;
