import { useState, useEffect } from 'react';
import {
  Card,
  FormLayout,
  Text,
  Checkbox,
  Spinner,
  Banner,
  ChoiceList,
} from '@shopify/polaris';
import { useBlocks } from '../hooks/useThemes';

function BlockPicker({
  themeId,
  templateName,
  sectionId,
  onBlocksChange,
  selectedBlockIds = []
}) {
  const { blocks, loading, error } = useBlocks(themeId, templateName, sectionId);
  const [localSelectedBlocks, setLocalSelectedBlocks] = useState(selectedBlockIds);

  // Update local state when prop changes
  useEffect(() => {
    setLocalSelectedBlocks(selectedBlockIds);
  }, [selectedBlockIds]);

  const handleBlockToggle = (blockId) => {
    const newSelection = localSelectedBlocks.includes(blockId)
      ? localSelectedBlocks.filter(id => id !== blockId)
      : [...localSelectedBlocks, blockId];

    setLocalSelectedBlocks(newSelection);
    onBlocksChange?.(newSelection);
  };

  if (!sectionId) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <Spinner size="small" />
          <Text as="p" variant="bodyMd">
            Loading blocks...
          </Text>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Banner status="critical">
          <p>Error loading blocks: {error}</p>
        </Banner>
      </Card>
    );
  }

  if (blocks.length === 0) {
    return (
      <Card>
        <Banner status="info">
          <p>
            This section has no blocks. The schedule will apply to the entire section.
          </p>
        </Banner>
      </Card>
    );
  }

  return (
    <Card>
      <FormLayout>
        <Text as="h2" variant="headingMd">
          Select Blocks (Optional)
        </Text>

        <Banner>
          <p>
            Select specific blocks to schedule, or leave all unchecked to schedule the entire section.
          </p>
        </Banner>

        <div>
          {blocks.map((block) => (
            <div key={block.id} style={{ marginBottom: '8px' }}>
              <Checkbox
                label={
                  <div>
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      {block.displayLabel}
                    </Text>
                    <Text as="p" variant="bodySm" color="subdued">
                      ID: {block.id} | Position: {block.position}
                    </Text>
                  </div>
                }
                checked={localSelectedBlocks.includes(block.id)}
                onChange={() => handleBlockToggle(block.id)}
              />
            </div>
          ))}
        </div>

        {localSelectedBlocks.length > 0 && (
          <Banner status="info">
            <p>
              {localSelectedBlocks.length} block{localSelectedBlocks.length !== 1 ? 's' : ''} selected
            </p>
          </Banner>
        )}
      </FormLayout>
    </Card>
  );
}

export default BlockPicker;
