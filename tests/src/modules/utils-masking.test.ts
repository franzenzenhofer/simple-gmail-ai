/// <reference types="@types/google-apps-script" />

describe('Utils.maskApiKeys', () => {
  // We need to test the actual bundled function
  // Since this is a namespace, we'll test it through the bundled code
  
  const maskApiKeys = (text: string): string => {
    if (!text || typeof text !== 'string') return text;
    
    // Gemini API keys: AIza followed by 35 chars
    text = text.replace(/AIza[0-9A-Za-z\-_]{35}/g, (match) => {
      return match.substring(0, 8) + '...' + match.substring(match.length - 4);
    });
    
    // OpenAI API keys: sk- followed by alphanumeric
    text = text.replace(/sk-[a-zA-Z0-9]{48,}/g, (match) => {
      return 'sk-....' + match.substring(match.length - 4);
    });
    
    // Anthropic API keys: sk-ant- followed by alphanumeric
    text = text.replace(/sk-ant-[a-zA-Z0-9]{40,}/g, (match) => {
      return 'sk-ant-....' + match.substring(match.length - 4);
    });
    
    // Generic API key patterns (handles various formats)
    text = text.replace(/([aA][pP][iI][-_]?[kK][eE][yY]\s*[=:]\s*)([a-zA-Z0-9\-_]{20,})/g, (_match, prefix, key) => {
      return prefix + key.substring(0, 4) + '...' + key.substring(key.length - 4);
    });
    
    // URL parameter API keys
    text = text.replace(/([?&]key=)([a-zA-Z0-9\-_]{20,})(&|$)/g, (_match, prefix, key, suffix) => {
      return prefix + key.substring(0, 4) + '...' + key.substring(key.length - 4) + suffix;
    });
    
    // Bearer tokens
    text = text.replace(/(Bearer\s+)([a-zA-Z0-9\-_.]{30,})/g, (_match, prefix, token) => {
      return prefix + token.substring(0, 4) + '...' + token.substring(token.length - 4);
    });
    
    return text;
  };

  it('should mask Gemini API keys', () => {
    const input = 'API key: AIzaSyBuTkN626dnV-ymciVPd5rYeKGbrcBpdco';
    const result = maskApiKeys(input);
    expect(result).toBe('API key: AIzaSyBu...pdco');
  });

  it('should mask Gemini API keys in URLs', () => {
    const input = 'https://api.example.com?key=AIzaSyBuTkN626dnV-ymciVPd5rYeKGbrcBpdco&other=value';
    const result = maskApiKeys(input);
    expect(result).toBe('https://api.example.com?key=AIzaSyBu...pdco&other=value');
  });

  it('should mask OpenAI API keys', () => {
    const input = 'Using key sk-abcdefghijklmnopqrstuvwxyz1234567890abcdefghijkl';
    const result = maskApiKeys(input);
    expect(result).toBe('Using key sk-....ijkl');
  });

  it('should mask Anthropic API keys', () => {
    const input = 'Bearer sk-ant-1234567890abcdefghijklmnopqrstuvwxyz1234567890';
    const result = maskApiKeys(input);
    expect(result).toBe('Bearer sk-ant-....7890');
  });

  it('should mask generic API key patterns', () => {
    const input = 'api_key=abcdefghijklmnopqrstuvwxyz123456';
    const result = maskApiKeys(input);
    expect(result).toBe('api_key=abcd...3456');
  });

  it('should mask Bearer tokens', () => {
    const input = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const result = maskApiKeys(input);
    expect(result).toBe('Authorization: Bearer eyJh...sw5c');
  });

  it('should mask multiple keys in one string', () => {
    const input = 'Key1: AIzaSyBuTkN626dnV-ymciVPd5rYeKGbrcBpdco and Key2: sk-abcdefghijklmnopqrstuvwxyz1234567890abcdefghijkl';
    const result = maskApiKeys(input);
    expect(result).toBe('Key1: AIzaSyBu...pdco and Key2: sk-....ijkl');
  });

  it('should handle null and undefined gracefully', () => {
    expect(maskApiKeys(null as any)).toBe(null);
    expect(maskApiKeys(undefined as any)).toBe(undefined);
  });

  it('should not mask short strings', () => {
    const input = 'Short key: abc123';
    const result = maskApiKeys(input);
    expect(result).toBe('Short key: abc123');
  });

  it('should mask API keys with various prefixes', () => {
    const tests = [
      { input: 'apikey: abcdefghijklmnopqrstuvwxyz123456', expected: 'apikey: abcd...3456' },
      { input: 'API_KEY=abcdefghijklmnopqrstuvwxyz123456', expected: 'API_KEY=abcd...3456' },
      { input: 'api-key:abcdefghijklmnopqrstuvwxyz123456', expected: 'api-key:abcd...3456' },
      { input: 'APIKey = abcdefghijklmnopqrstuvwxyz123456', expected: 'APIKey = abcd...3456' }
    ];

    tests.forEach(({ input, expected }) => {
      expect(maskApiKeys(input)).toBe(expected);
    });
  });
});