import { useState } from 'react';
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
import { useThemes, useTemplates, useSections } from '../hooks/useThemes';

function SectionPicker({ onSelect, selectedThemeId, selectedTemplate, selectedSection }) {
  const { publishedTheme, loading: themeLoading } = useThemes();
  const { templates, loading: templatesLoading } = useTemplates(
    selectedThemeId || publishedTheme?.id
  );
  const { sections, loading: sectionsLoading } = useSections(
    selectedThemeId || publishedTheme?.id,
    selectedTemplate
  );

  const [localTemplate, setLocalTemplate] = useState(selectedTemplate || '');
  const [localSection, setLocalSection] = useState(selectedSection || '');

  const themeId = selectedThemeId || publishedTheme?.id;

  const handleTemplateChange = (value) => {
    setLocalTemplate(value);
    setLocalSection(''); // Reset section when template changes
    onSelect?.({
      themeId,
      templateName: value,
      sectionId: '',
    });
  };

  const handleSectionClick = (sectionId) => {
    setLocalSection(sectionId);
    onSelect?.({
      themeId,
      templateName: localTemplate,
      sectionId,
    });
  };

  if (themeLoading) {
    return (
      <Card>
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <Spinner size="large" />
          <Text as="p" variant="bodyMd">
            Loading theme...
          </Text>
        </div>
      </Card>
    );
  }

  if (!publishedTheme) {
    return (
      <Card>
        <Banner status="warning">
          <p>No published theme found</p>
        </Banner>
      </Card>
    );
  }

  const templateOptions = [
    { label: 'Select a template', value: '' },
    ...templates.map((t) => ({
      label: t.filename,
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

        <div>
          <Text as="p" variant="bodyMd" color="subdued">
            Theme: <strong>{publishedTheme.name}</strong>
          </Text>
        </div>

        <Select
          label="Template"
          options={templateOptions}
          value={localTemplate}
          onChange={handleTemplateChange}
          disabled={templatesLoading}
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
              Sections in {localTemplate}
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
