/**
 * Custom Jest matchers that use JSON.stringify for better output formatting
 */

declare global {
  namespace jest {
    interface Matchers<R> {
      toEqualJSON(expected: any): R;
      toMatchJSON(expected: any): R;
    }
  }
}

expect.extend({
  toEqualJSON(received, expected) {
    const pass = JSON.stringify(received) === JSON.stringify(expected);
    
    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received, null, 2)} not to equal ${JSON.stringify(expected, null, 2)}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected:\n${JSON.stringify(expected, null, 2)}\n\nreceived:\n${JSON.stringify(received, null, 2)}`,
        pass: false,
      };
    }
  },
  
  toMatchJSON(received, expected) {
    // Deep partial matching with JSON formatting
    const receivedStr = JSON.stringify(received, null, 2);
    const expectedStr = JSON.stringify(expected, null, 2);
    
    // Check if expected is a subset of received
    const isMatch = Object.keys(expected).every(key => {
      if (typeof expected[key] === 'object' && expected[key] !== null) {
        return this.equals(received[key], expected[key]);
      }
      return received[key] === expected[key];
    });
    
    if (isMatch) {
      return {
        message: () => `expected ${receivedStr} not to match ${expectedStr}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected to match:\n${expectedStr}\n\nreceived:\n${receivedStr}`,
        pass: false,
      };
    }
  },
});

// Export to ensure TypeScript includes this file
export {};