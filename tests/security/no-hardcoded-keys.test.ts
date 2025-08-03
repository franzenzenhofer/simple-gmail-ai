/**
 * Security test to ensure no hardcoded API keys exist in the codebase
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Security: No Hardcoded API Keys', () => {
  const projectRoot = path.join(__dirname, '..', '..');
  const srcDir = path.join(projectRoot, 'src');
  const testDir = path.join(projectRoot, 'tests');
  
  // Patterns that indicate potential API keys
  const apiKeyPatterns = [
    /AIzaSy[A-Za-z0-9_-]{33}/g,  // Google API key format
    /sk-[A-Za-z0-9]{48}/g,        // OpenAI format
    /api[_-]?key\s*[:=]\s*['\"]AIzaSy[^'\"]+['\"](?!\s*\|\|)/gi, // Google API key assignments (not fallbacks)
    /api[_-]?key\s*[:=]\s*['\"]sk-[^'\"]+['\"](?!\s*\|\|)/gi, // OpenAI key assignments (not fallbacks)
  ];
  
  // Files to exclude from scanning
  const excludeFiles = [
    'node_modules',
    '.git',
    'dist',
    '.env',
    '.env.local',
    'package-lock.json',
    'no-hardcoded-keys.test.ts' // This test file itself
  ];
  
  function scanFile(filePath: string): string[] {
    const content = fs.readFileSync(filePath, 'utf8');
    const violations: string[] = [];
    
    // Skip test files that test masking functionality
    if (filePath.includes('utils-masking.test.ts') || filePath.includes('utils.test.ts')) {
      return violations;
    }
    
    apiKeyPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          // Skip environment variable references and example keys in comments/strings
          if (!match.includes('process.env') && 
              !match.includes('||') && 
              !match.includes('Example:') &&
              !match.includes('example') &&
              !match.includes('Format:') &&
              !match.includes('A1B2C3D4E5F6G7')) {
            violations.push(`Found potential hardcoded key in ${filePath}: ${match.substring(0, 20)}...`);
          }
        });
      }
    });
    
    return violations;
  }
  
  function scanDirectory(dir: string): string[] {
    const violations: string[] = [];
    
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      
      // Skip excluded files/dirs
      if (excludeFiles.some(exclude => fullPath.includes(exclude))) {
        return;
      }
      
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        violations.push(...scanDirectory(fullPath));
      } else if (stat.isFile() && (file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.gs'))) {
        violations.push(...scanFile(fullPath));
      }
    });
    
    return violations;
  }
  
  test('should not contain any hardcoded API keys in source files', () => {
    const srcViolations = scanDirectory(srcDir);
    expect(srcViolations).toEqual([]);
  });
  
  test('should not contain any hardcoded API keys in test files', () => {
    const testViolations = scanDirectory(testDir);
    expect(testViolations).toEqual([]);
  });
  
  test('integration test should use environment variables for API keys', () => {
    const integrationTestPath = path.join(srcDir, 'integration-test.ts');
    if (fs.existsSync(integrationTestPath)) {
      const content = fs.readFileSync(integrationTestPath, 'utf8');
      
      // Check that it uses process.env
      expect(content).toContain('process.env');
      expect(content).toContain('GEMINI_API_KEY');
      
      // Ensure no hardcoded keys
      const hardcodedPattern = /const\s+API_KEY\s*=\s*['"][A-Za-z0-9_-]{20,}['"]/;
      expect(content).not.toMatch(hardcodedPattern);
    }
  });
});