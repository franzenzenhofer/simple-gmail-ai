/**
 * Tests for appsscript.json manifest security
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

describe('Apps Script Manifest Security', () => {
  const manifestPath = path.join(__dirname, '..', 'src', 'appsscript.json');
  
  it('should have valid JSON syntax', () => {
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    expect(() => JSON.parse(manifestContent)).not.toThrow();
  });

  it('should not contain deprecated urlFetchWhitelist', () => {
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);
    
    expect(manifest).not.toHaveProperty('urlFetchWhitelist');
    expect(manifestContent).not.toContain('urlFetchWhitelist');
  });

  it('should not contain executionApi with ANYONE access', () => {
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);
    
    expect(manifest).not.toHaveProperty('executionApi');
    expect(manifestContent).not.toContain('executionApi');
    expect(manifestContent).not.toContain('ANYONE');
  });

  it('should have required OAuth scopes', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    expect(manifest.oauthScopes).toBeDefined();
    expect(Array.isArray(manifest.oauthScopes)).toBe(true);
    
    // Verify essential scopes are present
    const requiredScopes = [
      'https://www.googleapis.com/auth/gmail.addons.execute',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/script.external_request'
    ];
    
    requiredScopes.forEach(scope => {
      expect(manifest.oauthScopes).toContain(scope);
    });
  });

  it('should have proper add-on configuration', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    expect(manifest.addOns).toBeDefined();
    expect(manifest.addOns.common).toBeDefined();
    expect(manifest.addOns.gmail).toBeDefined();
    
    // Verify homepage trigger
    expect(manifest.addOns.common.homepageTrigger).toEqual({
      enabled: true,
      runFunction: 'onHomepage'
    });
    
    // Verify Gmail contextual trigger
    expect(manifest.addOns.gmail.contextualTriggers).toBeDefined();
    expect(manifest.addOns.gmail.contextualTriggers[0]).toEqual({
      unconditional: {},
      onTriggerFunction: 'onGmailMessage'
    });
  });

  it('should use V8 runtime', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.runtimeVersion).toBe('V8');
  });

  it('should have Stackdriver logging enabled', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.exceptionLogging).toBe('STACKDRIVER');
  });

  it('should not have any web app configuration', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest).not.toHaveProperty('webapp');
  });
});