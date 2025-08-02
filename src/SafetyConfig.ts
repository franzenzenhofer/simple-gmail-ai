/**
 * Safety Configuration for Gmail Support Triage AI
 * CRITICAL: Prevents accidental email sending during development/testing
 */

export class SafetyConfig {
  private static readonly SAFETY_KEY = 'GMAIL_AI_SAFETY_MODE';
  private static readonly DEV_MODE_KEY = 'GMAIL_AI_DEV_MODE';
  
  /**
   * Check if we're in development/testing mode
   * When true, NO EMAILS WILL BE SENT
   */
  static isDevelopmentMode(): boolean {
    try {
      const devMode = PropertiesService.getUserProperties().getProperty(this.DEV_MODE_KEY);
      const safetyMode = PropertiesService.getUserProperties().getProperty(this.SAFETY_KEY);
      
      // Default to SAFE MODE if not explicitly set to production
      return devMode !== 'false' || safetyMode === 'true';
    } catch (e) {
      // If we can't check, assume we're in dev mode for safety
      return true;
    }
  }
  
  /**
   * Enable production mode (DANGEROUS - allows sending emails)
   * Requires explicit confirmation
   */
  static enableProductionMode(confirmation: string): boolean {
    if (confirmation !== 'I UNDERSTAND THIS WILL SEND REAL EMAILS') {
      console.error('Production mode NOT enabled - incorrect confirmation');
      return false;
    }
    
    PropertiesService.getUserProperties().setProperty(this.DEV_MODE_KEY, 'false');
    PropertiesService.getUserProperties().setProperty(this.SAFETY_KEY, 'false');
    console.warn('⚠️ PRODUCTION MODE ENABLED - EMAILS WILL BE SENT!');
    return true;
  }
  
  /**
   * Enable development mode (SAFE - no emails sent)
   */
  static enableDevelopmentMode(): void {
    PropertiesService.getUserProperties().setProperty(this.DEV_MODE_KEY, 'true');
    PropertiesService.getUserProperties().setProperty(this.SAFETY_KEY, 'true');
    console.log('✅ Development mode enabled - emails will NOT be sent');
  }
  
  /**
   * Log what would have been sent (for testing)
   */
  static logBlockedAction(action: string, details: any): void {
    console.log('🛡️ SAFETY MODE - Blocked action:', action);
    console.log('Details:', JSON.stringify(details, null, 2));
  }
}