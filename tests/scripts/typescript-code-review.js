#!/usr/bin/env node

/**
 * COMPREHENSIVE TYPESCRIPT CODE REVIEW FRAMEWORK
 * Multi-framework analysis for code quality, missing functions, and performance
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 TYPESCRIPT CODE REVIEW FRAMEWORK');
console.log('=====================================');

class CodeReviewFramework {
  constructor() {
    this.srcDir = path.join(__dirname, '../../src');
    this.results = {
      missingFunctions: [],
      typeErrors: [],
      unusedExports: [],
      circularDeps: [],
      performanceIssues: [],
      securityIssues: []
    };
  }

  // 1. ESLINT ANALYSIS WITH MULTIPLE RULESETS
  runESLintAnalysis() {
    console.log('\n📋 1. ESLINT ANALYSIS');
    console.log('---------------------');
    
    try {
      // Standard ESLint
      const eslintOutput = execSync('npx eslint src/**/*.ts --format=json', { encoding: 'utf8' });
      const eslintResults = JSON.parse(eslintOutput);
      
      let totalErrors = 0;
      let totalWarnings = 0;
      
      eslintResults.forEach(file => {
        totalErrors += file.errorCount;
        totalWarnings += file.warningCount;
        
        file.messages.forEach(msg => {
          if (msg.severity === 2) { // Error
            this.results.typeErrors.push({
              file: file.filePath,
              line: msg.line,
              message: msg.message,
              rule: msg.ruleId
            });
          }
        });
      });
      
      console.log(`✅ ESLint: ${totalErrors} errors, ${totalWarnings} warnings`);
      
    } catch (error) {
      console.log('❌ ESLint failed:', error.message.substring(0, 100));
    }
  }

  // 2. TYPESCRIPT COMPILER ANALYSIS
  runTypeScriptAnalysis() {
    console.log('\n📋 2. TYPESCRIPT COMPILER');
    console.log('-------------------------');
    
    try {
      execSync('npx tsc --noEmit --strict', { encoding: 'utf8', stdio: 'pipe' });
      console.log('✅ TypeScript: No type errors');
    } catch (error) {
      const output = error.stdout || error.stderr || '';
      const errorLines = output.split('\n').filter(line => line.includes('error TS'));
      
      errorLines.forEach(line => {
        this.results.typeErrors.push({
          type: 'typescript',
          message: line
        });
      });
      
      console.log(`❌ TypeScript: ${errorLines.length} type errors`);
    }
  }

  // 3. DEPENDENCY ANALYSIS (Find circular dependencies)
  runDependencyAnalysis() {
    console.log('\n📋 3. DEPENDENCY ANALYSIS');
    console.log('-------------------------');
    
    const dependencies = new Map();
    
    // Scan all files for imports
    this.scanDirectory(this.srcDir, (filePath, content) => {
      const relativePath = path.relative(this.srcDir, filePath);
      const imports = this.extractImports(content);
      dependencies.set(relativePath, imports);
    });
    
    // Check for circular dependencies
    const visited = new Set();
    const visiting = new Set();
    
    const detectCycles = (file, path = []) => {
      if (visiting.has(file)) {
        const cycle = [...path, file];
        this.results.circularDeps.push(cycle);
        return;
      }
      
      if (visited.has(file)) return;
      
      visiting.add(file);
      const deps = dependencies.get(file) || [];
      
      deps.forEach(dep => {
        detectCycles(dep, [...path, file]);
      });
      
      visiting.delete(file);
      visited.add(file);
    };
    
    dependencies.forEach((_, file) => {
      if (!visited.has(file)) {
        detectCycles(file);
      }
    });
    
    if (this.results.circularDeps.length > 0) {
      console.log(`❌ Found ${this.results.circularDeps.length} circular dependencies`);
      this.results.circularDeps.forEach(cycle => {
        console.log('  🔄', cycle.join(' -> '));
      });
    } else {
      console.log('✅ No circular dependencies found');
    }
  }

  // 4. UNUSED EXPORTS DETECTION
  runUnusedExportsAnalysis() {
    console.log('\n📋 4. UNUSED EXPORTS ANALYSIS');
    console.log('-----------------------------');
    
    const exports = new Set();
    const imports = new Set();
    
    // Find all exports and imports
    this.scanDirectory(this.srcDir, (filePath, content) => {
      // Extract exports
      const exportMatches = content.match(/export\s+(?:function|class|const|let|var)\s+(\w+)/g);
      if (exportMatches) {
        exportMatches.forEach(match => {
          const name = match.match(/export\s+(?:function|class|const|let|var)\s+(\w+)/)[1];
          exports.add(name);
        });
      }
      
      // Extract imports (simplified)
      const importMatches = content.match(/import.*?{([^}]+)}/g);
      if (importMatches) {
        importMatches.forEach(match => {
          const names = match.match(/{([^}]+)}/)[1].split(',').map(s => s.trim());
          names.forEach(name => imports.add(name));
        });
      }
    });
    
    const unusedExports = [...exports].filter(exp => !imports.has(exp));
    
    if (unusedExports.length > 0) {
      console.log(`⚠️  Found ${unusedExports.length} potentially unused exports`);
      unusedExports.forEach(exp => {
        console.log('  📤', exp);
        this.results.unusedExports.push(exp);
      });
    } else {
      console.log('✅ All exports appear to be used');
    }
  }

  // 5. PERFORMANCE ANALYSIS
  runPerformanceAnalysis() {
    console.log('\n📋 5. PERFORMANCE ANALYSIS');
    console.log('--------------------------');
    
    let issues = 0;
    
    this.scanDirectory(this.srcDir, (filePath, content) => {
      // Check for potential performance issues
      const performancePatterns = [
        { pattern: /console\.log\(/g, issue: 'Console logs in production code', severity: 'warning' },
        { pattern: /JSON\.stringify\([^)]{100,}\)/g, issue: 'Large JSON.stringify operations', severity: 'warning' },
        { pattern: /for\s*\([^)]*\)\s*{[^}]*for\s*\(/g, issue: 'Nested loops detected', severity: 'error' },
        { pattern: /while\s*\(true\)/g, issue: 'Infinite loop detected', severity: 'error' },
        { pattern: /setTimeout\s*\(\s*.*,\s*0\s*\)/g, issue: 'setTimeout with 0 delay', severity: 'warning' }
      ];
      
      performancePatterns.forEach(({ pattern, issue, severity }) => {
        const matches = content.match(pattern);
        if (matches) {
          issues++;
          this.results.performanceIssues.push({
            file: path.relative(this.srcDir, filePath),
            issue,
            severity,
            count: matches.length
          });
        }
      });
    });
    
    if (issues > 0) {
      console.log(`⚠️  Found ${issues} potential performance issues`);
      this.results.performanceIssues.forEach(issue => {
        console.log(`  ${issue.severity === 'error' ? '❌' : '⚠️ '} ${issue.file}: ${issue.issue} (${issue.count})`);
      });
    } else {
      console.log('✅ No performance issues detected');
    }
  }

  // 6. SECURITY ANALYSIS
  runSecurityAnalysis() {
    console.log('\n📋 6. SECURITY ANALYSIS');
    console.log('-----------------------');
    
    let securityIssues = 0;
    
    this.scanDirectory(this.srcDir, (filePath, content) => {
      const securityPatterns = [
        { pattern: /eval\s*\(/g, issue: 'eval() usage detected', severity: 'critical' },
        { pattern: /innerHTML\s*=/g, issue: 'innerHTML assignment (XSS risk)', severity: 'high' },
        { pattern: /document\.write\s*\(/g, issue: 'document.write usage', severity: 'high' },
        { pattern: /AIzaSy[A-Za-z0-9_-]{33}/g, issue: 'Hardcoded API key detected', severity: 'critical' },
        { pattern: /password.*=.*["'][^"']{1,}["']/gi, issue: 'Hardcoded password', severity: 'critical' },
        { pattern: /Math\.random\(\)/g, issue: 'Non-cryptographic random', severity: 'medium' }
      ];
      
      securityPatterns.forEach(({ pattern, issue, severity }) => {
        const matches = content.match(pattern);
        if (matches) {
          securityIssues++;
          this.results.securityIssues.push({
            file: path.relative(this.srcDir, filePath),
            issue,
            severity,
            count: matches.length
          });
        }
      });
    });
    
    if (securityIssues > 0) {
      console.log(`⚠️  Found ${securityIssues} potential security issues`);
      this.results.securityIssues.forEach(issue => {
        const icon = issue.severity === 'critical' ? '🚨' : issue.severity === 'high' ? '❌' : '⚠️';
        console.log(`  ${icon} ${issue.file}: ${issue.issue} (${issue.count})`);
      });
    } else {
      console.log('✅ No security issues detected');
    }
  }

  // UTILITY METHODS
  scanDirectory(dir, callback) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        this.scanDirectory(fullPath, callback);
      } else if (file.endsWith('.ts')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        callback(fullPath, content);
      }
    });
  }

  extractImports(content) {
    const imports = [];
    const importRegex = /import.*?from\s+['"`]([^'"`]+)['"`]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    return imports;
  }

  // GENERATE REPORT
  generateReport() {
    console.log('\n📊 COMPREHENSIVE CODE REVIEW REPORT');
    console.log('====================================');
    
    const totalIssues = this.results.typeErrors.length + 
                       this.results.circularDeps.length + 
                       this.results.performanceIssues.length + 
                       this.results.securityIssues.length;
    
    console.log(`\n🎯 SUMMARY: ${totalIssues} total issues found`);
    console.log(`  - Type Errors: ${this.results.typeErrors.length}`);
    console.log(`  - Circular Dependencies: ${this.results.circularDeps.length}`);
    console.log(`  - Performance Issues: ${this.results.performanceIssues.length}`);
    console.log(`  - Security Issues: ${this.results.securityIssues.length}`);
    console.log(`  - Unused Exports: ${this.results.unusedExports.length}`);
    
    if (totalIssues === 0) {
      console.log('\n✅ CODE QUALITY: EXCELLENT - No critical issues found!');
      return 0;
    } else if (totalIssues < 5) {
      console.log('\n⚠️  CODE QUALITY: GOOD - Minor issues to address');
      return 1;
    } else {
      console.log('\n❌ CODE QUALITY: NEEDS ATTENTION - Multiple issues found');
      return 2;
    }
  }

  // RUN ALL ANALYSES
  async runAll() {
    this.runESLintAnalysis();
    this.runTypeScriptAnalysis();
    this.runDependencyAnalysis();
    this.runUnusedExportsAnalysis();
    this.runPerformanceAnalysis();
    this.runSecurityAnalysis();
    
    return this.generateReport();
  }
}

// RUN THE ANALYSIS
if (require.main === module) {
  const reviewer = new CodeReviewFramework();
  reviewer.runAll().then(exitCode => {
    process.exit(exitCode);
  }).catch(error => {
    console.error('❌ Code review failed:', error);
    process.exit(3);
  });
}

module.exports = CodeReviewFramework;