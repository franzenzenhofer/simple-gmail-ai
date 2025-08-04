/**
 * AI Schemas Module
 * JSON schemas and structured response types for AI interactions
 */

namespace AISchemas {
  // JSON Schema for email classification responses
  export const CLASSIFICATION_SCHEMA = {
    '$schema': 'http://json-schema.org/draft-07/schema#',
    'type': 'object',
    'required': ['label'],
    'properties': {
      'label': {
        'type': 'string',
        'description': 'Dynamic label from docs - can be any label name'
      },
      'confidence': {
        'type': 'number',
        'minimum': 0,
        'maximum': 1
      },
      'reasoning': {
        'type': 'string',
        'maxLength': 200
      }
    },
    'additionalProperties': false
  };
  
  // JSON Schema for reply generation responses  
  export const REPLY_SCHEMA = {
    '$schema': 'http://json-schema.org/draft-07/schema#',
    'type': 'object',
    'required': ['reply'],
    'properties': {
      'reply': {
        'type': 'string',
        'minLength': 1,
        'maxLength': 2000
      },
      'tone': {
        'type': 'string',
        'enum': ['formal', 'friendly', 'neutral']
      },
      'category': {
        'type': 'string',
        'enum': ['inquiry', 'complaint', 'request', 'feedback', 'other']
      }
    },
    'additionalProperties': false
  };
  
  // JSON Schema for batch processing responses
  export const BATCH_SCHEMA = {
    '$schema': 'http://json-schema.org/draft-07/schema#',
    'type': 'array',
    'items': {
      'type': 'object',
      'required': ['id', 'label'],
      'properties': {
        'id': {
          'type': 'string'
        },
        'label': {
          'type': 'string',
          'description': 'Dynamic label from docs - can be any label name'
        },
        'confidence': {
          'type': 'number',
          'minimum': 0,
          'maximum': 1
        }
      },
      'additionalProperties': false
    },
    'minItems': 1,
    'maxItems': 20
  };
  
  // TypeScript interfaces for structured responses
  export interface ClassificationResponse {
    label: string; // Dynamic label from AI/docs
    confidence?: number;
    reasoning?: string;
  }
  
  export interface ReplyResponse {
    reply: string;
    tone?: 'formal' | 'friendly' | 'neutral';
    category?: 'inquiry' | 'complaint' | 'request' | 'feedback' | 'other';
  }
  
  export interface BatchResponse {
    id: string;
    label: string; // Dynamic label from AI/docs
    confidence?: number;
  }
  
  // Schema registry for easy access
  export const SCHEMAS = {
    classification: CLASSIFICATION_SCHEMA,
    reply: REPLY_SCHEMA,
    batch: BATCH_SCHEMA
  } as const;
  
  export type SchemaType = keyof typeof SCHEMAS;
  
  export function getSchema(type: SchemaType) {
    return SCHEMAS[type];
  }
  
  export function createPromptForSchema(basePrompt: string, schemaType: SchemaType): string {
    let promptSuffix = '';
    
    switch (schemaType) {
      case 'classification':
        promptSuffix = '\n\nRespond with JSON in this exact format: {"label": "exact_label_name_from_docs", "confidence": 0.0-1.0, "reasoning": "brief explanation"}';
        break;
      case 'reply':
        promptSuffix = '\n\nRespond with JSON in this exact format: {"reply": "your response", "tone": "formal/friendly/neutral", "category": "inquiry/complaint/request/feedback/other"}';
        break;
      case 'batch':
        promptSuffix = '\n\nRespond with JSON array in this exact format: [{"id": "email_id", "label": "exact_label_name_from_docs", "confidence": 0.0-1.0}]';
        break;
    }
    
    return basePrompt + promptSuffix;
  }
}