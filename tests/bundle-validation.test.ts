import { describe, test, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

describe('Bundle Validation', () => {
  const srcDir = path.join(__dirname, '..', 'src', 'modules');
  const bundleFile = path.join(__dirname, '..', 'bundle.js');
  
  test('All namespaces used in modules should be in bundle configuration', () => {
    // Read bundle.js to get configured namespaces
    const bundleContent = fs.readFileSync(bundleFile, 'utf8');
    const namespaceMatch = bundleContent.match(/const namespaceToModule = \{([^}]+)\}/s);
    expect(namespaceMatch).toBeTruthy();
    
    const configuredNamespaces = new Set<string>();
    if (namespaceMatch) {
      const namespaceLines = namespaceMatch[1].split('\n');
      namespaceLines.forEach(line => {
        const match = line.match(/'([^']+)':/);
        if (match) {
          configuredNamespaces.add(match[1]);
        }
      });
    }
    
    // Get all TypeScript files
    const tsFiles = fs.readdirSync(srcDir)
      .filter(file => file.endsWith('.ts'))
      .map(file => path.join(srcDir, file));
    
    // Check each file for namespace usage
    const missingNamespaces = new Set<string>();
    const namespaceUsage = new Map<string, string[]>();
    
    tsFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      const fileName = path.basename(file);
      
      // Find all namespace usages (e.g., Config.VERSION, AppLogger.info)
      const namespacePattern = /\b([A-Z][a-zA-Z0-9]*)\.[a-zA-Z]/g;
      let match;
      
      while ((match = namespacePattern.exec(content)) !== null) {
        const namespace = match[1];
        
        // Skip common false positives
        if (['Math', 'Date', 'JSON', 'Object', 'Array', 'String', 'Number', 
             'Boolean', 'RegExp', 'Error', 'Promise', 'Set', 'Map',
             'CardService', 'PropertiesService', 'GmailApp', 'DriveApp',
             'UrlFetchApp', 'Utilities', 'SpreadsheetApp', 'DocumentApp',
             'GoogleAppsScript', 'ScriptApp', 'CacheService', 'LockService',
             'Session', 'Logger', 'Drive',
             // These are enums/types from within modules, not separate namespaces
             'Types', 'CONFIG', 'DisplayStyle', 'ErrorSeverity', 'AppErrorType',
             'LogLevel', 'MODEL', 'WelcomeState'].includes(namespace)) {
          continue;
        }
        
        // Track usage
        if (!namespaceUsage.has(namespace)) {
          namespaceUsage.set(namespace, []);
        }
        namespaceUsage.get(namespace)!.push(fileName);
        
        // Check if it's configured
        if (!configuredNamespaces.has(namespace)) {
          missingNamespaces.add(namespace);
        }
      }
    });
    
    // Report missing namespaces
    if (missingNamespaces.size > 0) {
      const missingList = Array.from(missingNamespaces).map(ns => {
        const files = [...new Set(namespaceUsage.get(ns) || [])];
        return `  - ${ns} (used in: ${files.join(', ')})`;
      }).join('\n');
      
      throw new Error(`Found namespaces used in code but not configured in bundle.js:\n${missingList}\n\n` +
                      `Add these to the namespaceToModule mapping in bundle.js`);
    }
  });
  
  test('All namespaces in bundle should have corresponding modules', () => {
    const bundleContent = fs.readFileSync(bundleFile, 'utf8');
    
    // Extract coreModules array
    const coreModulesMatch = bundleContent.match(/const coreModules = \[([^\]]+)\]/s);
    expect(coreModulesMatch).toBeTruthy();
    
    const coreModules = new Set<string>();
    if (coreModulesMatch) {
      const moduleLines = coreModulesMatch[1].split('\n');
      moduleLines.forEach(line => {
        const match = line.match(/'([^']+)'/);
        if (match) {
          coreModules.add(match[1]);
        }
      });
    }
    
    // Extract namespaceToModule mapping
    const namespaceMatch = bundleContent.match(/const namespaceToModule = \{([^}]+)\}/s);
    expect(namespaceMatch).toBeTruthy();
    
    const missingModules: string[] = [];
    
    if (namespaceMatch) {
      const namespaceLines = namespaceMatch[1].split('\n');
      namespaceLines.forEach(line => {
        const match = line.match(/'[^']+': '([^']+)'/);
        if (match) {
          const moduleName = match[1];
          if (!coreModules.has(moduleName)) {
            missingModules.push(moduleName);
          }
        }
      });
    }
    
    if (missingModules.length > 0) {
      throw new Error(`Found modules in namespaceToModule but not in coreModules array:\n  - ${missingModules.join('\n  - ')}`);
    }
  });
  
  test('All TypeScript module files (except types-only) should be in bundle', () => {
    const bundleContent = fs.readFileSync(bundleFile, 'utf8');
    const coreModulesMatch = bundleContent.match(/const coreModules = \[([^\]]+)\]/s);
    expect(coreModulesMatch).toBeTruthy();
    
    const coreModules = new Set<string>();
    if (coreModulesMatch) {
      const moduleLines = coreModulesMatch[1].split('\n');
      moduleLines.forEach(line => {
        const match = line.match(/'([^']+)'/);
        if (match) {
          coreModules.add(match[1]);
        }
      });
    }
    
    // Get all TypeScript module files
    const tsFiles = fs.readdirSync(srcDir)
      .filter(file => file.endsWith('.ts'))
      .map(file => file.replace('.ts', ''));
    
    // Exclude types.ts since it only contains interfaces
    const missingFiles = tsFiles
      .filter(file => file !== 'types')
      .filter(file => !coreModules.has(file));
    
    if (missingFiles.length > 0) {
      throw new Error(`Found TypeScript modules not included in bundle.js coreModules:\n  - ${missingFiles.join('\n  - ')}`);
    }
  });
});