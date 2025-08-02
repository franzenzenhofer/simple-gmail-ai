#!/usr/bin/env node

/**
 * Sync README.md with values from config.ts
 * Ensures documentation stays up-to-date with actual configuration
 */

const fs = require('fs');
const path = require('path');

// Read config.ts
const configPath = path.join(__dirname, 'src/modules/config.ts');
const configContent = fs.readFileSync(configPath, 'utf8');

// Extract configuration values
function extractConfig(content) {
  const config = {
    labels: {},
    prompts: {},
    gemini: {},
    colors: {}
  };

  // Extract LABELS
  const labelsMatch = content.match(/export const LABELS = \{([^}]+)\}/s);
  if (labelsMatch) {
    const labelLines = labelsMatch[1].trim().split('\n');
    labelLines.forEach(line => {
      const match = line.match(/(\w+):\s*'([^']+)'/);
      if (match) {
        config.labels[match[1]] = match[2];
      }
    });
  }

  // Extract GEMINI model
  const modelMatch = content.match(/MODEL:\s*'([^']+)'/);
  if (modelMatch) {
    config.gemini.model = modelMatch[1];
  }

  // Extract temperature
  const tempMatch = content.match(/TEMPERATURE:\s*([\d.]+)/);
  if (tempMatch) {
    config.gemini.temperature = tempMatch[1];
  }

  return config;
}

// Read README.md
const readmePath = path.join(__dirname, 'README.md');
let readmeContent = fs.readFileSync(readmePath, 'utf8');

// Extract config from config.ts
const config = extractConfig(configContent);

// Update label information in README
if (config.labels.SUPPORT && config.labels.NOT_SUPPORT) {
  // Update short labels section
  const shortLabelsPattern = /Shorter Labels[^:]*:\s*`[^`]+`,\s*`[^`]+`,\s*`[^`]+`,\s*`[^`]+`/;
  const newShortLabels = `Shorter Labels: \`${config.labels.SUPPORT}\`, \`${config.labels.NOT_SUPPORT}\`, \`${config.labels.AI_PROCESSED}\`, \`${config.labels.AI_ERROR}\``;
  
  readmeContent = readmeContent.replace(shortLabelsPattern, newShortLabels);
  
  // Update smart labeling section
  const smartLabelingPattern = /Smart Labeling[^:]*: Clean labels: `[^`]+`, `[^`]+`, `[^`]+`, `[^`]+`/;
  const newSmartLabeling = `Smart Labeling**: Clean labels: \`${config.labels.SUPPORT}\`, \`${config.labels.NOT_SUPPORT}\`, \`${config.labels.AI_PROCESSED}\`, \`${config.labels.AI_ERROR}\``;
  
  readmeContent = readmeContent.replace(smartLabelingPattern, newSmartLabeling);
}

// Update Gemini model information
if (config.gemini.model) {
  const modelPattern = /Google's Gemini [0-9.]+ [A-Za-z]+ AI model/;
  const modelName = config.gemini.model.replace('gemini-', 'Gemini ').replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
  const newModelText = `Google's ${modelName} AI model`;
  
  readmeContent = readmeContent.replace(modelPattern, newModelText);
}

// Write updated README
fs.writeFileSync(readmePath, readmeContent);

console.log('✅ README.md synced with config.ts');
console.log('📋 Updated values:');
console.log(`   - Labels: ${Object.values(config.labels).join(', ')}`);
console.log(`   - Model: ${config.gemini.model}`);
console.log(`   - Temperature: ${config.gemini.temperature}`);