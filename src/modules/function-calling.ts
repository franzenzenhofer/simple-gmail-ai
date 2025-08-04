/**
 * Function Calling Module
 * Implements function-calling JSON schema for structured AI responses
 */

namespace FunctionCalling {
  
  // Function definitions for email processing
  export interface FunctionDefinition {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, unknown>;
      required?: string[];
    };
  }
  
  // Gemini schema format
  export interface GeminiSchema {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, unknown>;
      required?: string[];
    };
  }
  
  // Email classification function
  export const CLASSIFY_EMAIL_FUNCTION: FunctionDefinition = {
    name: 'classifyEmail',
    description: 'Classify an email as support request or not',
    parameters: {
      type: 'object',
      properties: {
        classification: {
          type: 'string',
          enum: ['support', 'not'],
          description: 'Whether the email is a support request'
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Confidence score for the classification'
        },
        reasoning: {
          type: 'string',
          description: 'Brief explanation for the classification'
        },
        category: {
          type: 'string',
          enum: ['technical', 'billing', 'feature_request', 'bug_report', 'general', 'not_support'],
          description: 'Specific category of support request'
        }
      },
      required: ['classification']
    }
  };
  
  // Reply generation function
  export const GENERATE_REPLY_FUNCTION: FunctionDefinition = {
    name: 'generateReply',
    description: 'Generate a professional reply to a support email',
    parameters: {
      type: 'object',
      properties: {
        reply: {
          type: 'string',
          description: 'The complete email reply text'
        },
        tone: {
          type: 'string',
          enum: ['formal', 'friendly', 'technical', 'empathetic'],
          description: 'Tone of the reply'
        },
        suggestedActions: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Suggested follow-up actions for the support agent'
        },
        requiresEscalation: {
          type: 'boolean',
          description: 'Whether this issue needs to be escalated'
        }
      },
      required: ['reply']
    }
  };
  
  // Email analysis function (comprehensive)
  export const ANALYZE_EMAIL_FUNCTION: FunctionDefinition = {
    name: 'analyzeEmail',
    description: 'Perform comprehensive analysis of an email',
    parameters: {
      type: 'object',
      properties: {
        classification: {
          type: 'string',
          enum: ['support', 'not'],
          description: 'Whether the email is a support request'
        },
        sentiment: {
          type: 'string',
          enum: ['positive', 'neutral', 'negative', 'urgent'],
          description: 'Overall sentiment of the email'
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Priority level of the email'
        },
        topics: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Main topics discussed in the email'
        },
        entities: {
          type: 'object',
          properties: {
            products: {
              type: 'array',
              items: { type: 'string' },
              description: 'Product names mentioned'
            },
            features: {
              type: 'array',
              items: { type: 'string' },
              description: 'Feature names mentioned'
            },
            errorCodes: {
              type: 'array',
              items: { type: 'string' },
              description: 'Error codes or IDs mentioned'
            }
          }
        },
        suggestedLabels: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Additional Gmail labels to apply'
        }
      },
      required: ['classification', 'sentiment', 'priority']
    }
  };
  
  /**
   * Create a function-calling prompt with schema
   */
  export function createFunctionCallingPrompt(
    content: string,
    functions: FunctionDefinition[],
    instructions?: string
  ): string {
    let prompt = instructions || 'Please analyze the following content and respond with the appropriate function call.';
    prompt += '\n\nAvailable functions:\n';
    
    functions.forEach(func => {
      prompt += `\n${func.name}: ${func.description}`;
    });
    
    prompt += '\n\nContent to analyze:\n' + content;
    prompt += '\n\nRespond with a JSON object containing the function name and parameters.';
    
    return prompt;
  }
  
  /**
   * Parse function call response
   */
  export function parseFunctionCallResponse(response: string): {
    functionName: string;
    parameters: unknown;
  } | null {
    try {
      // Handle potential markdown code blocks
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      
      if (parsed.function && parsed.parameters) {
        return {
          functionName: parsed.function,
          parameters: parsed.parameters
        };
      } else if (parsed.name && parsed.arguments) {
        // Alternative format
        return {
          functionName: parsed.name,
          parameters: parsed.arguments
        };
      }
      
      // Try to extract function name and parameters directly
      const functionName = Object.keys(parsed).find(key => 
        ['classifyEmail', 'generateReply', 'analyzeEmail'].includes(key)
      );
      
      if (functionName) {
        return {
          functionName,
          parameters: parsed[functionName]
        };
      }
      
      return null;
    } catch (error) {
      AppLogger.error('Failed to parse function call response', {
        error: String(error),
        response: response.substring(0, 200)
      });
      return null;
    }
  }
  
  /**
   * Convert function schema to Gemini-compatible format
   */
  export function toGeminiSchema(func: FunctionDefinition): GeminiSchema {
    return {
      name: func.name,
      description: func.description,
      parameters: {
        type: 'object',
        properties: func.parameters.properties,
        required: func.parameters.required || []
      }
    };
  }
  
  /**
   * Classify email using function calling
   */
  export function classifyEmailWithFunction(
    apiKey: string,
    emailContent: string,
    useAdvancedAnalysis: boolean = false
  ): {
    success: boolean;
    classification?: 'support' | 'not';
    metadata?: unknown;
    error?: string;
  } {
    try {
      const func = useAdvancedAnalysis ? ANALYZE_EMAIL_FUNCTION : CLASSIFY_EMAIL_FUNCTION;
      const prompt = createFunctionCallingPrompt(
        emailContent,
        [func],
        'Analyze this email and determine if it\'s a support request.'
      );
      
      // Create function calling schema
      const schema = {
        type: 'object',
        properties: {
          function: { type: 'string', const: func.name },
          parameters: func.parameters
        },
        required: ['function', 'parameters']
      };
      
      const result = AI.callGemini(apiKey, prompt, schema);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error
        };
      }
      
      const functionCall = parseFunctionCallResponse(result.data as string);
      if (!functionCall) {
        // Fallback to direct parsing
        if (result.data && typeof result.data === 'object' && 'parameters' in result.data) {
          const params = (result.data as { parameters: unknown }).parameters;
          const paramsObj = params as { classification?: string };
          return {
            success: true,
            classification: (paramsObj?.classification || 'not') as 'support' | 'not',
            metadata: params
          };
        }
        
        return {
          success: false,
          error: 'Failed to parse function call response'
        };
      }
      
      const fcParams = functionCall.parameters as { classification?: string };
      return {
        success: true,
        classification: (fcParams?.classification || 'not') as 'support' | 'not',
        metadata: functionCall.parameters
      };
      
    } catch (error) {
      return {
        success: false,
        error: Utils.logAndHandleError(error, 'Function calling classification')
      };
    }
  }
  
  /**
   * Generate reply using function calling
   */
  export function generateReplyWithFunction(
    apiKey: string,
    emailContent: string,
    additionalContext?: string
  ): {
    success: boolean;
    reply?: string;
    metadata?: unknown;
    error?: string;
  } {
    try {
      const prompt = createFunctionCallingPrompt(
        emailContent + (additionalContext ? '\n\nAdditional context: ' + additionalContext : ''),
        [GENERATE_REPLY_FUNCTION],
        'Generate a professional and helpful reply to this support email.'
      );
      
      const schema = {
        type: 'object',
        properties: {
          function: { type: 'string', const: 'generateReply' },
          parameters: GENERATE_REPLY_FUNCTION.parameters
        },
        required: ['function', 'parameters']
      };
      
      const result = AI.callGemini(apiKey, prompt, schema);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error
        };
      }
      
      const functionCall = parseFunctionCallResponse(result.data as string);
      if (!functionCall) {
        // Fallback handling
        if (result.data && typeof result.data === 'object' && 'parameters' in result.data) {
          const params = (result.data as { parameters: unknown }).parameters;
          const paramsObj = params as { reply?: string };
          if (paramsObj?.reply) {
            return {
              success: true,
              reply: paramsObj.reply,
              metadata: params
            };
          }
        }
        
        return {
          success: false,
          error: 'Failed to parse function call response'
        };
      }
      
      const fcParams = functionCall.parameters as { reply?: string };
      return {
        success: true,
        reply: fcParams?.reply || '',
        metadata: functionCall.parameters
      };
      
    } catch (error) {
      return {
        success: false,
        error: Utils.logAndHandleError(error, 'Function calling reply generation')
      };
    }
  }
  
  /**
   * Batch analyze emails using function calling
   */
  export function batchAnalyzeEmails(
    apiKey: string,
    emails: Array<{id: string; content: string}>,
    maxBatchSize: number = 5
  ): Array<{
    id: string;
    success: boolean;
    result?: unknown;
    error?: string;
  }> {
    const results: Array<{id: string; success: boolean; result?: unknown; error?: string}> = [];
    
    // Process in smaller batches for function calling
    for (let i = 0; i < emails.length; i += maxBatchSize) {
      const batch = emails.slice(i, i + maxBatchSize);
      
      batch.forEach(email => {
        const analysis = classifyEmailWithFunction(apiKey, email.content, true);
        
        results.push({
          id: email.id,
          success: analysis.success,
          result: analysis.metadata,
          error: analysis.error
        });
      });
      
      // Add small delay between batches
      if (i + maxBatchSize < emails.length) {
        Utilities.sleep(100);
      }
    }
    
    return results;
  }
}