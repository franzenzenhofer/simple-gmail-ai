/**
 * Label Cache Module
 * Manages Gmail label ID caching for resilient label operations
 */

namespace LabelCache {
  interface CachedLabel {
    id: string;
    name: string;
    lastUpdated: number;
  }
  
  interface LabelCacheData {
    [labelName: string]: CachedLabel;
  }
  
  // Gmail label with runtime methods not in type definitions
  interface GmailLabelWithId extends GoogleAppsScript.Gmail.GmailLabel {
    getId(): string;
  }
  
  const CACHE_KEY = 'GMAIL_LABEL_CACHE';
  const CACHE_EXPIRY_HOURS = 24; // Cache labels for 24 hours
  
  /**
   * Get or create a Gmail label with ID caching
   */
  export function getOrCreateLabel(labelName: string): GoogleAppsScript.Gmail.GmailLabel {
    try {
      // Try to get from cache first
      const cachedLabel = getCachedLabel(labelName);
      if (cachedLabel) {
        // Verify the cached label still exists
        try {
          const labels = GmailApp.getUserLabels();
          const existingLabel = labels.find(label => (label as GmailLabelWithId).getId() === cachedLabel.id);
          if (existingLabel) {
            // Update cache if name changed
            if (existingLabel.getName() !== cachedLabel.name) {
              AppLogger.info('📝 LABEL NAME CHANGED - UPDATING CACHE', {
                labelId: cachedLabel.id,
                oldName: cachedLabel.name,
                newName: existingLabel.getName()
              });
              updateCachedLabel(labelName, (existingLabel as GmailLabelWithId).getId(), existingLabel.getName());
            }
            return existingLabel;
          } else {
            // Cached label no longer exists, remove from cache
            AppLogger.warn('🗑️ CACHED LABEL NO LONGER EXISTS', {
              labelName: labelName,
              cachedId: cachedLabel.id
            });
            removeCachedLabel(labelName);
          }
        } catch (error) {
          AppLogger.warn('Error verifying cached label', {
            labelName: labelName,
            error: String(error)
          });
        }
      }
      
      // Cache miss or invalid cache - get/create label normally
      const label = Utils.getOrCreateLabelDirect(labelName);
      AppLogger.info('📧 OBTAINED GMAIL LABEL', {
        labelName: labelName,
        labelId: (label as GmailLabelWithId).getId()
      });
      
      // Cache the label
      updateCachedLabel(labelName, (label as GmailLabelWithId).getId(), label.getName());
      
      return label;
      
    } catch (error) {
      // Fallback to original logic for critical failures
      AppLogger.error('Label cache failed, falling back to direct access', {
        labelName: labelName,
        error: String(error)
      });
      
      return Utils.getOrCreateLabelDirect(labelName);
    }
  }
  
  /**
   * Get a label by its cached ID
   */
  export function getLabelById(labelId: string): GoogleAppsScript.Gmail.GmailLabel | null {
    try {
      const labels = GmailApp.getUserLabels();
      return labels.find(label => (label as GmailLabelWithId).getId() === labelId) || null;
    } catch (error) {
      AppLogger.error('Failed to get label by ID', {
        labelId: labelId,
        error: String(error)
      });
      return null;
    }
  }
  
  /**
   * Find label by name using cache
   */
  export function findLabelByName(labelName: string): GoogleAppsScript.Gmail.GmailLabel | null {
    const cachedLabel = getCachedLabel(labelName);
    if (cachedLabel) {
      const label = getLabelById(cachedLabel.id);
      if (label) {
        return label;
      }
      // Cache is stale, remove it
      removeCachedLabel(labelName);
    }
    
    // Fallback to direct lookup
    try {
      return GmailApp.getUserLabelByName(labelName);
    } catch (error) {
      AppLogger.error('Failed to find label by name', {
        labelName: labelName,
        error: String(error)
      });
      return null;
    }
  }
  
  /**
   * Get cached label info
   */
  function getCachedLabel(labelName: string): CachedLabel | null {
    try {
      const props = PropertiesService.getUserProperties();
      const cacheData = props.getProperty(CACHE_KEY);
      if (!cacheData) return null;
      
      const cache: LabelCacheData = JSON.parse(cacheData);
      const cached = cache[labelName];
      
      if (!cached) return null;
      
      // Check if cache is expired
      const ageHours = (Date.now() - cached.lastUpdated) / (1000 * 60 * 60);
      if (ageHours > CACHE_EXPIRY_HOURS) {
        AppLogger.info('📅 LABEL CACHE EXPIRED', {
          labelName: labelName,
          ageHours: ageHours.toFixed(1)
        });
        removeCachedLabel(labelName);
        return null;
      }
      
      return cached;
    } catch (error) {
      AppLogger.error('Failed to get cached label', {
        labelName: labelName,
        error: String(error)
      });
      return null;
    }
  }
  
  /**
   * Update cached label info
   */
  function updateCachedLabel(labelName: string, labelId: string, actualName: string): void {
    try {
      const props = PropertiesService.getUserProperties();
      const cacheData = props.getProperty(CACHE_KEY);
      const cache: LabelCacheData = cacheData ? JSON.parse(cacheData) : {};
      
      cache[labelName] = {
        id: labelId,
        name: actualName,
        lastUpdated: Date.now()
      };
      
      props.setProperty(CACHE_KEY, JSON.stringify(cache));
      
      AppLogger.info('💾 LABEL CACHED', {
        labelName: labelName,
        labelId: labelId,
        actualName: actualName
      });
    } catch (error) {
      AppLogger.error('Failed to cache label', {
        labelName: labelName,
        labelId: labelId,
        error: String(error)
      });
    }
  }
  
  /**
   * Remove cached label
   */
  function removeCachedLabel(labelName: string): void {
    try {
      const props = PropertiesService.getUserProperties();
      const cacheData = props.getProperty(CACHE_KEY);
      if (!cacheData) return;
      
      const cache: LabelCacheData = JSON.parse(cacheData);
      delete cache[labelName];
      
      props.setProperty(CACHE_KEY, JSON.stringify(cache));
      
      AppLogger.info('🗑️ LABEL REMOVED FROM CACHE', {
        labelName: labelName
      });
    } catch (error) {
      AppLogger.error('Failed to remove cached label', {
        labelName: labelName,
        error: String(error)
      });
    }
  }
  
  /**
   * Get all cached labels for debugging
   */
  export function getAllCachedLabels(): LabelCacheData {
    try {
      const props = PropertiesService.getUserProperties();
      const cacheData = props.getProperty(CACHE_KEY);
      return cacheData ? JSON.parse(cacheData) : {};
    } catch (error) {
      AppLogger.error('Failed to get all cached labels', {
        error: String(error)
      });
      return {};
    }
  }
  
  /**
   * Clear entire label cache
   */
  export function clearCache(): void {
    try {
      const props = PropertiesService.getUserProperties();
      props.deleteProperty(CACHE_KEY);
      AppLogger.info('🧹 LABEL CACHE CLEARED');
    } catch (error) {
      AppLogger.error('Failed to clear label cache', {
        error: String(error)
      });
    }
  }
  
  /**
   * Migrate existing installations to use label caching
   */
  export function migrateExistingLabels(): void {
    try {
      AppLogger.info('🔄 STARTING LABEL CACHE MIGRATION');
      
      // Only migrate system labels - all others come from docs
      const labelsToMigrate = [
        Config.LABELS.AI_PROCESSED,
        Config.LABELS.AI_ERROR
      ];
      
      // Also cache any existing labels that might have been created from docs
      const allLabels = GmailApp.getUserLabels();
      allLabels.forEach(label => {
        const labelName = label.getName();
        if (!labelsToMigrate.includes(labelName)) {
          labelsToMigrate.push(labelName);
        }
      });
      
      let migrated = 0;
      labelsToMigrate.forEach(labelName => {
        try {
          const existingLabel = GmailApp.getUserLabelByName(labelName);
          if (existingLabel) {
            updateCachedLabel(labelName, (existingLabel as GmailLabelWithId).getId(), existingLabel.getName());
            migrated++;
          }
        } catch (error) {
          AppLogger.warn('Failed to migrate label', {
            labelName: labelName,
            error: String(error)
          });
        }
      });
      
      AppLogger.info('✅ LABEL CACHE MIGRATION COMPLETE', {
        labelsFound: migrated,
        totalChecked: labelsToMigrate.length
      });
    } catch (error) {
      AppLogger.error('Label cache migration failed', {
        error: String(error)
      });
    }
  }
  
  /**
   * Health check for label cache
   */
  export function healthCheck(): {
    cacheSize: number;
    expiredEntries: number;
    validEntries: number;
    errors: string[];
  } {
    const result = {
      cacheSize: 0,
      expiredEntries: 0,
      validEntries: 0,
      errors: [] as string[]
    };
    
    try {
      const cache = getAllCachedLabels();
      result.cacheSize = Object.keys(cache).length;
      
      const now = Date.now();
      
      Object.entries(cache).forEach(([labelName, cached]) => {
        const ageHours = (now - cached.lastUpdated) / (1000 * 60 * 60);
        
        if (ageHours > CACHE_EXPIRY_HOURS) {
          result.expiredEntries++;
        } else {
          // Try to verify the label still exists
          try {
            const label = getLabelById(cached.id);
            if (label) {
              result.validEntries++;
            } else {
              result.errors.push(`Label ${labelName} (${cached.id}) no longer exists`);
            }
          } catch (error) {
            result.errors.push(`Failed to verify label ${labelName}: ${error}`);
          }
        }
      });
      
    } catch (error) {
      result.errors.push(`Health check failed: ${error}`);
    }
    
    return result;
  }
}