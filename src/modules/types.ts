/**
 * Type Definitions Module
 * Contains all TypeScript interfaces and types
 */

namespace Types {
  export interface FormInputs {
    [key: string]: {
      stringValues?: string[];
    };
  }
  
  export interface GeminiResponse {
    candidates?: Array<{
      content: {
        parts: Array<{
          text: string;
        }>;
      };
    }>;
    error?: {
      message: string;
    };
  }
  
  export interface ProcessingStats {
    scanned: number;
    supports: number;
    drafted: number;
    sent: number;
    errors: number;
    labelCounts: { [labelName: string]: number };
    aiProcessedCount: number;  // ai✓ labels applied
    aiErrorCount: number;      // aiX labels applied
  }
}