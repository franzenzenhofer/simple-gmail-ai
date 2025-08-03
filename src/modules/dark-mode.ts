/**
 * Dark Mode Module
 * Adaptive dark mode palette for Gmail theme support
 */

namespace DarkMode {
  
  // Theme detection
  export interface ThemeInfo {
    isDarkMode: boolean;
    accentColor?: string;
    backgroundColor?: string;
    textColor?: string;
  }
  
  // Color palette definitions
  export const LIGHT_THEME = {
    primary: '#1a73e8',        // Google Blue
    primaryDark: '#1967d2',
    primaryLight: '#4285f4',
    secondary: '#ea4335',      // Google Red
    success: '#0f9d58',        // Google Green
    warning: '#f9ab00',        // Google Yellow
    error: '#d33b27',
    
    background: '#ffffff',
    surface: '#f8f9fa',
    surfaceVariant: '#e8eaed',
    
    textPrimary: '#202124',
    textSecondary: '#5f6368',
    textDisabled: '#80868b',
    
    border: '#dadce0',
    divider: '#e8eaed',
    
    // Card specific
    cardBackground: '#ffffff',
    cardHeaderBackground: '#f8f9fa',
    
    // Button specific
    buttonPrimary: '#1a73e8',
    buttonPrimaryHover: '#1967d2',
    buttonSecondary: '#f8f9fa',
    buttonSecondaryHover: '#e8eaed'
  };
  
  export const DARK_THEME = {
    primary: '#8ab4f8',        // Light blue for dark mode
    primaryDark: '#669df6',
    primaryLight: '#aecbfa',
    secondary: '#f28b82',      // Light red for dark mode
    success: '#81c995',        // Light green for dark mode
    warning: '#fdd663',        // Light yellow for dark mode
    error: '#f28b82',
    
    background: '#202124',
    surface: '#292a2d',
    surfaceVariant: '#35363a',
    
    textPrimary: '#e8eaed',
    textSecondary: '#9aa0a6',
    textDisabled: '#5f6368',
    
    border: '#5f6368',
    divider: '#35363a',
    
    // Card specific
    cardBackground: '#292a2d',
    cardHeaderBackground: '#35363a',
    
    // Button specific
    buttonPrimary: '#8ab4f8',
    buttonPrimaryHover: '#aecbfa',
    buttonSecondary: '#35363a',
    buttonSecondaryHover: '#444548'
  };
  
  // Gmail-specific theme variations
  export const GMAIL_THEMES = {
    default: LIGHT_THEME,
    dark: DARK_THEME,
    
    // Custom Gmail themes
    softGray: {
      ...LIGHT_THEME,
      primary: '#5f6368',
      background: '#f5f5f5',
      surface: '#eeeeee'
    },
    
    highContrast: {
      ...DARK_THEME,
      textPrimary: '#ffffff',
      textSecondary: '#e8eaed',
      border: '#9aa0a6',
      primary: '#aecbfa'
    }
  };
  
  /**
   * Detect current Gmail theme
   */
  export function detectTheme(): ThemeInfo {
    try {
      // Try to detect from Gmail's theme settings
      // Note: This is a simplified detection - real implementation would need
      // to check Gmail's actual theme API or DOM elements
      
      // For now, we'll check if user has dark mode preference
      const isDarkMode = isDarkModeEnabled();
      
      return {
        isDarkMode,
        backgroundColor: isDarkMode ? DARK_THEME.background : LIGHT_THEME.background,
        textColor: isDarkMode ? DARK_THEME.textPrimary : LIGHT_THEME.textPrimary,
        accentColor: isDarkMode ? DARK_THEME.primary : LIGHT_THEME.primary
      };
      
    } catch (error) {
      AppLogger.error('Failed to detect theme', { error: String(error) });
      return { isDarkMode: false };
    }
  }
  
  /**
   * Check if dark mode is enabled
   */
  export function isDarkModeEnabled(): boolean {
    try {
      // Check user properties for saved preference
      const savedPreference = PropertiesService.getUserProperties().getProperty('DARK_MODE_ENABLED');
      if (savedPreference !== null) {
        return savedPreference === 'true';
      }
      
      // Default to light mode
      return false;
      
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Toggle dark mode preference
   */
  export function toggleDarkMode(): boolean {
    const currentMode = isDarkModeEnabled();
    const newMode = !currentMode;
    
    PropertiesService.getUserProperties().setProperty('DARK_MODE_ENABLED', String(newMode));
    
    AppLogger.info('🌓 DARK MODE TOGGLED', {
      previousMode: currentMode ? 'dark' : 'light',
      newMode: newMode ? 'dark' : 'light'
    });
    
    return newMode;
  }
  
  /**
   * Get current theme colors
   */
  export function getCurrentTheme(): typeof LIGHT_THEME {
    return isDarkModeEnabled() ? DARK_THEME : LIGHT_THEME;
  }
  
  /**
   * Create themed card with proper colors
   */
  export function createThemedCard(builder: GoogleAppsScript.Card_Service.CardBuilder): GoogleAppsScript.Card_Service.CardBuilder {
    const cardService = CardService;
    
    // Note: CardService has limited styling options
    // We can only set certain properties
    
    // Set display style based on theme
    if (isDarkModeEnabled()) {
      builder.setDisplayStyle(cardService.DisplayStyle.REPLACE);
    }
    
    return builder;
  }
  
  /**
   * Create themed section with proper styling
   */
  export function createThemedSection(title?: string): GoogleAppsScript.Card_Service.CardSection {
    const section = CardService.newCardSection();
    
    if (title) {
      // Section headers automatically adapt to Gmail theme
      section.setHeader(title);
    }
    
    return section;
  }
  
  /**
   * Create themed button
   */
  export function createThemedButton(
    text: string,
    isPrimary: boolean = true
  ): GoogleAppsScript.Card_Service.TextButton {
    const button = CardService.newTextButton()
      .setText(text)
      .setTextButtonStyle(
        isPrimary 
          ? CardService.TextButtonStyle.FILLED 
          : CardService.TextButtonStyle.TEXT
      );
    
    // Buttons automatically adapt to Gmail theme
    return button;
  }
  
  /**
   * Create themed text with appropriate styling
   */
  export function createThemedText(
    text: string,
    _isSecondary: boolean = false
  ): GoogleAppsScript.Card_Service.TextParagraph {
    // Note: We can't directly set text color in CardService
    // Text automatically adapts to Gmail theme
    
    const textWidget = CardService.newTextParagraph()
      .setText(text);
    
    return textWidget;
  }
  
  /**
   * Create themed icon
   */
  export function createThemedIcon(
    iconUrl: string,
    altText: string
  ): GoogleAppsScript.Card_Service.Image {
    // For dark mode, we might want to use inverted icons
    const themedIconUrl = isDarkModeEnabled() && iconUrl.includes('_light') 
      ? iconUrl.replace('_light', '_dark')
      : iconUrl;
    
    return CardService.newImage()
      .setImageUrl(themedIconUrl)
      .setAltText(altText);
  }
  
  /**
   * Apply theme to notification
   */
  export function createThemedNotification(
    message: string
  ): GoogleAppsScript.Card_Service.Notification {
    // Notifications automatically adapt to Gmail theme
    return CardService.newNotification()
      .setText(message);
  }
  
  /**
   * Get CSS-like color value for logs/debugging
   */
  export function getThemeColorCSS(colorName: keyof typeof LIGHT_THEME): string {
    const theme = getCurrentTheme();
    return theme[colorName] || '#000000';
  }
  
  /**
   * Initialize dark mode settings
   */
  export function initializeDarkMode(): void {
    // Check if this is first run
    const initialized = PropertiesService.getUserProperties().getProperty('DARK_MODE_INITIALIZED');
    
    if (!initialized) {
      // Set default based on system preference (if we could detect it)
      // For now, default to light mode
      PropertiesService.getUserProperties().setProperty('DARK_MODE_ENABLED', 'false');
      PropertiesService.getUserProperties().setProperty('DARK_MODE_INITIALIZED', 'true');
      
      AppLogger.info('🌓 DARK MODE INITIALIZED', {
        defaultMode: 'light'
      });
    }
  }
}