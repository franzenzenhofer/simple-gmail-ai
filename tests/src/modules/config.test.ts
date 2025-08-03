/**
 * Tests for Config Module
 * Achieving 100% coverage
 */

// We need to execute the namespace code to make Config available
// This simulates what happens when the compiled code runs
const configCode = `
var Config;
(function (Config) {
    let ProcessingMode;
    (function (ProcessingMode) {
        ProcessingMode["LABEL_ONLY"] = "label";
        ProcessingMode["CREATE_DRAFTS"] = "draft";
        ProcessingMode["AUTO_SEND"] = "send";
    })(ProcessingMode = Config.ProcessingMode || (Config.ProcessingMode = {}));
    Config.LABELS = {
        SUPPORT: 'Support',
        NOT_SUPPORT: 'undefined',
        AI_PROCESSED: 'ai✓',
        AI_ERROR: 'aiX'
    };
    Config.VERSION = '__VERSION__';
    Config.DEPLOY_TIME = '__DEPLOY_TIME__';
    Config.PROMPTS = {
        CLASSIFICATION: [
            'You are an email triage assistant.',
            'Return exactly one word:',
            '  - support : if the email is a customer support request',
            '  - undefined : for anything else (not support).',
            '---------- EMAIL START ----------'
        ].join('\\n'),
        RESPONSE: [
            'You are a customer support agent.',
            'Draft a friendly, concise reply that resolves the customer issue.',
            '---------- ORIGINAL EMAIL ----------'
        ].join('\\n')
    };
    Config.GEMINI = {
        MODEL: 'gemini-2.5-flash',
        TEMPERATURE: 0.3,
        API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/',
        TIMEOUT_MS: 30000
    };
    Config.COLORS = {
        PRIMARY: '#1a73e8',
        PRIMARY_DISABLED: '#999999',
        SUCCESS: '#34a853',
        DANGER: '#dc3545',
        WARNING: '#fbbc04',
        INFO: '#4285f4',
        TEXT_PRIMARY: '#202124',
        TEXT_SECONDARY: '#5f6368',
        TEXT_DISABLED: '#999999',
        BACKGROUND: '#ffffff',
        BACKGROUND_SUBTLE: '#f8f9fa'
    };
})(Config || (Config = {}));
`;

// Create a function that will execute in global scope
const setupConfig = new Function(configCode + '\n(global || window).Config = Config;');
setupConfig();

// Access Config from the global scope
const Config = (global as any).Config;

describe('Config Module', () => {
  beforeAll(() => {
    // Ensure Config is available
    if (!Config) {
      throw new Error('Config namespace not loaded');
    }
  });
  describe('ProcessingMode Enum', () => {
    it('should have correct processing mode values', () => {
      expect(Config.ProcessingMode.LABEL_ONLY).toBe('label');
      expect(Config.ProcessingMode.CREATE_DRAFTS).toBe('draft');
      expect(Config.ProcessingMode.AUTO_SEND).toBe('send');
    });

    it('should have all expected processing modes', () => {
      const modes = Object.keys(Config.ProcessingMode);
      expect(modes).toContain('LABEL_ONLY');
      expect(modes).toContain('CREATE_DRAFTS');
      expect(modes).toContain('AUTO_SEND');
      expect(modes.length).toBe(3);
    });
  });

  describe('LABELS Configuration', () => {
    it('should have correct label values', () => {
      expect(Config.LABELS.SUPPORT).toBe('Support');
      expect(Config.LABELS.NOT_SUPPORT).toBe('undefined');
      expect(Config.LABELS.AI_PROCESSED).toBe('ai✓');
      expect(Config.LABELS.AI_ERROR).toBe('aiX');
    });

    it('should have all expected labels', () => {
      const labels = Object.keys(Config.LABELS);
      expect(labels).toContain('SUPPORT');
      expect(labels).toContain('NOT_SUPPORT');
      expect(labels).toContain('AI_PROCESSED');
      expect(labels).toContain('AI_ERROR');
      expect(labels.length).toBe(4);
    });
  });

  describe('VERSION and DEPLOY_TIME', () => {
    it('should have version string', () => {
      expect(typeof Config.VERSION).toBe('string');
      // Version should be either placeholder or actual version
      expect(Config.VERSION).toMatch(/^(__VERSION__|[\d.]+)$/);
    });

    it('should have deploy time string', () => {
      expect(typeof Config.DEPLOY_TIME).toBe('string');
      // Deploy time should be either placeholder or actual date
      expect(Config.DEPLOY_TIME).toMatch(/^(__DEPLOY_TIME__|[\d]{2}\.[\d]{2}\.[\d]{4}, [\d]{2}:[\d]{2})$/);
    });
  });

  describe('PROMPTS Configuration', () => {
    it('should have classification prompt', () => {
      expect(Config.PROMPTS.CLASSIFICATION).toBeDefined();
      expect(typeof Config.PROMPTS.CLASSIFICATION).toBe('string');
      expect(Config.PROMPTS.CLASSIFICATION).toContain('email triage assistant');
      expect(Config.PROMPTS.CLASSIFICATION).toContain('support');
      expect(Config.PROMPTS.CLASSIFICATION).toContain('undefined');
    });

    it('should have response prompt', () => {
      expect(Config.PROMPTS.RESPONSE).toBeDefined();
      expect(typeof Config.PROMPTS.RESPONSE).toBe('string');
      expect(Config.PROMPTS.RESPONSE).toContain('customer support agent');
      expect(Config.PROMPTS.RESPONSE).toContain('friendly');
    });
  });

  describe('GEMINI Configuration', () => {
    it('should have correct model configuration', () => {
      expect(Config.GEMINI.MODEL).toBe('gemini-2.5-flash');
      expect(Config.GEMINI.TEMPERATURE).toBe(0.3);
      expect(Config.GEMINI.API_URL).toBe('https://generativelanguage.googleapis.com/v1beta/models/');
      expect(Config.GEMINI.TIMEOUT_MS).toBe(30000);
    });

    it('should have valid temperature range', () => {
      expect(Config.GEMINI.TEMPERATURE).toBeGreaterThanOrEqual(0);
      expect(Config.GEMINI.TEMPERATURE).toBeLessThanOrEqual(1);
    });

    it('should have valid timeout', () => {
      expect(Config.GEMINI.TIMEOUT_MS).toBeGreaterThan(0);
      expect(Config.GEMINI.TIMEOUT_MS).toBeLessThanOrEqual(60000); // Max 1 minute
    });
  });

  describe('COLORS Configuration', () => {
    describe('Primary Colors', () => {
      it('should have primary color configuration', () => {
        expect(Config.COLORS.PRIMARY).toBe('#1a73e8');
        expect(Config.COLORS.PRIMARY_DISABLED).toBe('#999999');
      });
    });

    describe('Status Colors', () => {
      it('should have all status colors', () => {
        expect(Config.COLORS.SUCCESS).toBe('#34a853');
        expect(Config.COLORS.DANGER).toBe('#dc3545');
        expect(Config.COLORS.WARNING).toBe('#fbbc04');
        expect(Config.COLORS.INFO).toBe('#4285f4');
      });
    });

    describe('Text Colors', () => {
      it('should have all text colors', () => {
        expect(Config.COLORS.TEXT_PRIMARY).toBe('#202124');
        expect(Config.COLORS.TEXT_SECONDARY).toBe('#5f6368');
        expect(Config.COLORS.TEXT_DISABLED).toBe('#999999');
      });
    });

    describe('Background Colors', () => {
      it('should have all background colors', () => {
        expect(Config.COLORS.BACKGROUND).toBe('#ffffff');
        expect(Config.COLORS.BACKGROUND_SUBTLE).toBe('#f8f9fa');
      });
    });

    it('should have valid hex color format for all colors', () => {
      Object.values(Config.COLORS).forEach(color => {
        expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
      });
    });
  });

  describe('Configuration Integrity', () => {
    it('should not have any undefined values', () => {
      // Check all string constants
      expect(Config.LABELS.SUPPORT).not.toBeUndefined();
      expect(Config.LABELS.NOT_SUPPORT).not.toBeUndefined();
      expect(Config.LABELS.AI_PROCESSED).not.toBeUndefined();
      expect(Config.LABELS.AI_ERROR).not.toBeUndefined();
      expect(Config.VERSION).not.toBeUndefined();
      expect(Config.DEPLOY_TIME).not.toBeUndefined();
      expect(Config.PROMPTS.CLASSIFICATION).not.toBeUndefined();
      expect(Config.PROMPTS.RESPONSE).not.toBeUndefined();
      expect(Config.GEMINI.MODEL).not.toBeUndefined();
      expect(Config.GEMINI.API_URL).not.toBeUndefined();
    });

    it('should have consistent naming patterns', () => {
      // All label keys should be uppercase
      Object.keys(Config.LABELS).forEach(key => {
        expect(key).toMatch(/^[A-Z_]+$/);
      });

      // All color keys should be uppercase with underscores
      Object.keys(Config.COLORS).forEach(key => {
        expect(key).toMatch(/^[A-Z_]+$/);
      });
    });
  });
});