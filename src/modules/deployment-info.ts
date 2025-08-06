/**
 * Deployment Info Module
 * Single source of truth for deployment version and timestamp
 */

// Declare the global variable that's injected by deploy.sh
declare const DEPLOYMENT_VERSION: string | undefined;
declare const DEPLOYMENT_TIMESTAMP: string | undefined;

namespace DeploymentInfo {
  
  /**
   * Get the deployment version
   * This is injected by the build process in format YYYYMMDD_HHMMSS
   */
  export function getVersion(): string {
    return Config.VERSION || 'Unknown';
  }
  
  /**
   * Get the deployment timestamp string
   * This is injected by the build process
   */
  export function getDeploymentVersionString(): string {
    // DEPLOYMENT_VERSION is injected by deploy.sh
    return (typeof DEPLOYMENT_VERSION !== 'undefined') ? DEPLOYMENT_VERSION : '';
  }
  
  /**
   * Get formatted deployment date and time
   * Returns an object with formatted date and time strings
   */
  export function getFormattedDeploymentInfo(): { date: string; time: string; full: string } {
    const deploymentVersion = getDeploymentVersionString();
    
    if (deploymentVersion && deploymentVersion.match(/^\d{8}_\d{6}$/)) {
      // Parse the deployment version (YYYYMMDD_HHMMSS)
      const year = parseInt(deploymentVersion.substr(0, 4));
      const month = parseInt(deploymentVersion.substr(4, 2)) - 1; // JS months are 0-based
      const day = parseInt(deploymentVersion.substr(6, 2));
      const hour = parseInt(deploymentVersion.substr(9, 2));
      const minute = parseInt(deploymentVersion.substr(11, 2));
      const second = parseInt(deploymentVersion.substr(13, 2));
      
      // Create date object - this represents the deployment time in the deployer's timezone
      const deployDate = new Date(year, month, day, hour, minute, second);
      
      const dateStr = deployDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
      
      const timeStr = deployDate.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      const fullStr = `${dateStr} at ${timeStr}`;
      
      return {
        date: dateStr,
        time: timeStr,
        full: fullStr
      };
    } else {
      // Fallback to current time if no deployment version
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
      const timeStr = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      return {
        date: dateStr,
        time: timeStr,
        full: `${dateStr} at ${timeStr}`
      };
    }
  }
  
  /**
   * Get the version footer HTML for UI display
   */
  export function getVersionFooterHtml(): string {
    const version = getVersion();
    const deployInfo = getFormattedDeploymentInfo();
    return `<font color="#999999"><i>v${version} • Deployed ${deployInfo.full}</i></font>`;
  }
  
  /**
   * Get version info as plain text
   */
  export function getVersionText(): string {
    const version = getVersion();
    const deployInfo = getFormattedDeploymentInfo();
    return `v${version} • Deployed ${deployInfo.full}`;
  }
}