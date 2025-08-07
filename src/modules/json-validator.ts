/**
 * JSON Validator Module
 * Lightweight JSON schema validation for AI responses
 */

namespace JsonValidator {
  export interface ValidationResult {
    valid: boolean;
    errors?: string[];
  }

  // JSONSchema interface (moved from AI module to avoid circular dependency)
  export interface JSONSchema {
    '$schema'?: string;
    type?: string;
    required?: string[];
    properties?: Record<string, unknown>;
    additionalProperties?: boolean;
    items?: unknown;
    enum?: string[];
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    minItems?: number;
    maxItems?: number;
    format?: string;
    retryAttempt?: boolean;
    [key: string]: unknown;
  }
  
  export function validate(data: unknown, schema: unknown): ValidationResult {
    const errors: string[] = [];
    
    if (!validateRecursive(data, schema, '', errors)) {
      return { valid: false, errors };
    }
    
    return { valid: true };
  }
  
  function validateRecursive(data: unknown, schema: unknown, path: string, errors: string[]): boolean {
    try {
      const jsonSchema = schema as JSONSchema;
      
      if (jsonSchema.type === 'object') {
        if (typeof data !== 'object' || data === null || Array.isArray(data)) {
          errors.push(`${path}: Expected object, got ${typeof data}`);
          return false;
        }
        
        // Check required fields
        if (jsonSchema.required) {
          for (const field of jsonSchema.required) {
            if (!(field in data)) {
              errors.push(`${path}: Missing required field '${field}'`);
              return false;
            }
          }
        }
        
        // Check properties
        if (jsonSchema.properties) {
          for (const key in data) {
            const dataObj = data as Record<string, unknown>;
            const propSchema = jsonSchema.properties[key];
            const fieldPath = path ? `${path}.${key}` : key;
            
            if (!propSchema) {
              if (jsonSchema.additionalProperties === false) {
                errors.push(`${fieldPath}: Additional property not allowed`);
                return false;
              }
              continue;
            }
            
            if (!validateRecursive(dataObj[key], propSchema, fieldPath, errors)) {
              return false;
            }
          }
        }
        
        return true;
      }
      
      if (jsonSchema.type === 'string') {
        if (typeof data !== 'string') {
          errors.push(`${path}: Expected string, got ${typeof data}`);
          return false;
        }
        if (jsonSchema.enum && !jsonSchema.enum.includes(data)) {
          errors.push(`${path}: Value '${data}' not in allowed enum: ${jsonSchema.enum.join(', ')}`);
          return false;
        }
        if (jsonSchema.minLength && data.length < jsonSchema.minLength) {
          errors.push(`${path}: String too short, minimum length is ${jsonSchema.minLength}`);
          return false;
        }
        if (jsonSchema.maxLength && data.length > jsonSchema.maxLength) {
          errors.push(`${path}: String too long, maximum length is ${jsonSchema.maxLength}`);
          return false;
        }
        return true;
      }
      
      if (jsonSchema.type === 'number') {
        if (typeof data !== 'number') {
          errors.push(`${path}: Expected number, got ${typeof data}`);
          return false;
        }
        if (jsonSchema.minimum !== undefined && data < jsonSchema.minimum) {
          errors.push(`${path}: Number ${data} below minimum ${jsonSchema.minimum}`);
          return false;
        }
        if (jsonSchema.maximum !== undefined && data > jsonSchema.maximum) {
          errors.push(`${path}: Number ${data} above maximum ${jsonSchema.maximum}`);
          return false;
        }
        return true;
      }
      
      if (jsonSchema.type === 'array') {
        if (!Array.isArray(data)) {
          errors.push(`${path}: Expected array, got ${typeof data}`);
          return false;
        }
        if (jsonSchema.items) {
          for (let i = 0; i < data.length; i++) {
            if (!validateRecursive(data[i], jsonSchema.items, `${path}[${i}]`, errors)) {
              return false;
            }
          }
        }
        return true;
      }
      
      if (jsonSchema.type === 'boolean') {
        if (typeof data !== 'boolean') {
          errors.push(`${path}: Expected boolean, got ${typeof data}`);
          return false;
        }
        return true;
      }
      
      // Allow null values if type is null or not specified
      if (data === null && (jsonSchema.type === 'null' || !jsonSchema.type)) {
        return true;
      }
      
      return true;
    } catch (error) {
      errors.push(`${path}: Validation error - ${String(error)}`);
      return false;
    }
  }
  
  export function isValidJson(text: string): boolean {
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  }
  
  export function sanitizeJsonResponse(response: string): string {
    // Remove markdown code blocks if present
    let cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Remove any text before the first { or [
    const startBrace = cleaned.indexOf('{');
    const startBracket = cleaned.indexOf('[');
    
    if (startBrace === -1 && startBracket === -1) {
      return cleaned;
    }
    
    const start = startBrace === -1 ? startBracket :
                  startBracket === -1 ? startBrace :
                  Math.min(startBrace, startBracket);
    
    if (start > 0) {
      cleaned = cleaned.substring(start);
    }
    
    // Remove any text after the last } or ]
    const endBrace = cleaned.lastIndexOf('}');
    const endBracket = cleaned.lastIndexOf(']');
    
    const end = Math.max(endBrace, endBracket);
    if (end !== -1 && end < cleaned.length - 1) {
      cleaned = cleaned.substring(0, end + 1);
    }
    
    return cleaned;
  }
}