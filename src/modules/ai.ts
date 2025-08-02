/**
 * AI Service Module
 * Handles all Gemini API interactions
 */

namespace AI {
  export function callGemini(apiKey: string, prompt: string): string {
    const requestId = 'ai_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    
    AppLogger.info('🚀 AI REQUEST [' + requestId + ']', {
      model: Config.GEMINI.MODEL,
      promptLength: prompt.length,
      promptPreview: prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''),
      requestId
    });
    
    const url = Config.GEMINI.API_URL + Config.GEMINI.MODEL + ':generateContent?key=' + encodeURIComponent(apiKey);
    
    const payload = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: Config.GEMINI.TEMPERATURE
      }
    };
    
    try {
      const response = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      
      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();
      
      AppLogger.info('📨 AI RESPONSE [' + requestId + ']', {
        statusCode: responseCode,
        responseLength: responseText.length,
        requestId
      });
      
      if (responseCode !== 200) {
        AppLogger.error('❌ AI ERROR [' + requestId + ']', {
          statusCode: responseCode,
          error: responseText,
          requestId
        });
        throw new Error('API error: ' + responseCode);
      }
      
      const data = JSON.parse(responseText) as Types.GeminiResponse;
      
      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No response from AI');
      }
      
      const candidate = data.candidates[0];
      if (!candidate?.content?.parts?.[0]?.text) {
        throw new Error('Invalid response structure from AI');
      }
      const result = candidate.content.parts[0].text.trim();
      
      AppLogger.info('✅ AI RESULT [' + requestId + ']', {
        result,
        requestId,
        classification: result.toLowerCase().indexOf('support') === 0 ? 'SUPPORT' : 'NOT_SUPPORT'
      });
      
      return result;
    } catch (error) {
      AppLogger.error('Failed to call AI', { error: String(error), requestId });
      throw error;
    }
  }
}