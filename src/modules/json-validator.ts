/**
 * JSON Validator Module
 * Lightweight JSON schema validation for AI responses
 */

namespace JsonValidator {
  export interface ValidationResult {
    valid: boolean;
    errors?: string[];
  }
  
  export function validate(data: any, schema: any): ValidationResult {
    const errors: string[] = [];
    
    if (!validateRecursive(data, schema, '', errors)) {
      return { valid: false, errors };
    }
    
    return { valid: true };
  }
  
  function validateRecursive(data: any, schema: any, path: string, errors: string[]): boolean {
    try {
      if (schema.type === 'object') {
        if (typeof data !== 'object' || data === null || Array.isArray(data)) {
          errors.push(`${path}: Expected object, got ${typeof data}`);
          return false;
        }
        
        // Check required fields
        if (schema.required) {
          for (const field of schema.required) {
            if (!(field in data)) {
              errors.push(`${path}: Missing required field '${field}'`);
              return false;
            }
          }
        }
        
        // Check properties
        if (schema.properties) {
          for (const key in data) {
            const propSchema = schema.properties[key];
            const fieldPath = path ? `${path}.${key}` : key;
            
            if (!propSchema) {
              if (schema.additionalProperties === false) {
                errors.push(`${fieldPath}: Additional property not allowed`);
                return false;
              }
              continue;
            }
            
            if (!validateRecursive(data[key], propSchema, fieldPath, errors)) {
              return false;
            }
          }
        }
        
        return true;
      }
      
      if (schema.type === 'string') {
        if (typeof data !== 'string') {
          errors.push(`${path}: Expected string, got ${typeof data}`);
          return false;
        }
        if (schema.enum && !schema.enum.includes(data)) {
          errors.push(`${path}: Value '${data}' not in allowed enum: ${schema.enum.join(', ')}`);
          return false;
        }
        if (schema.minLength && data.length < schema.minLength) {
          errors.push(`${path}: String too short, minimum length is ${schema.minLength}`);
          return false;
        }
        if (schema.maxLength && data.length > schema.maxLength) {
          errors.push(`${path}: String too long, maximum length is ${schema.maxLength}`);
          return false;
        }
        return true;
      }
      
      if (schema.type === 'number') {
        if (typeof data !== 'number') {
          errors.push(`${path}: Expected number, got ${typeof data}`);
          return false;
        }
        if (schema.minimum !== undefined && data < schema.minimum) {
          errors.push(`${path}: Number ${data} below minimum ${schema.minimum}`);
          return false;
        }
        if (schema.maximum !== undefined && data > schema.maximum) {
          errors.push(`${path}: Number ${data} above maximum ${schema.maximum}`);
          return false;
        }
        return true;
      }
      
      if (schema.type === 'array') {
        if (!Array.isArray(data)) {
          errors.push(`${path}: Expected array, got ${typeof data}`);
          return false;
        }
        if (schema.items) {
          for (let i = 0; i < data.length; i++) {
            if (!validateRecursive(data[i], schema.items, `${path}[${i}]`, errors)) {
              return false;
            }
          }
        }
        return true;
      }
      
      if (schema.type === 'boolean') {
        if (typeof data !== 'boolean') {
          errors.push(`${path}: Expected boolean, got ${typeof data}`);
          return false;
        }
        return true;
      }
      
      // Allow null values if type is null or not specified
      if (data === null && (schema.type === 'null' || !schema.type)) {
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