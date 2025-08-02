/**
 * Test-friendly constants for ProcessingMode values
 * Mirrors the Config.ProcessingMode enum for use in Jest tests
 */

export const ProcessingMode = {
  LABEL_ONLY: 'label' as const,
  CREATE_DRAFTS: 'draft' as const,
  AUTO_SEND: 'send' as const
} as const;

export type ProcessingModeType = typeof ProcessingMode[keyof typeof ProcessingMode];