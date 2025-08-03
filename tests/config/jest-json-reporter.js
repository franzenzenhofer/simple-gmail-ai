/**
 * Custom Jest reporter that uses JSON.stringify for better test output formatting
 * This improves readability of complex objects and arrays in test failures
 */

class JSONFormattedReporter {
  onTestResult(test, testResult) {
    if (testResult.testResults) {
      testResult.testResults.forEach(result => {
        if (result.status === 'failed' && result.failureMessages) {
          // Format failure messages with JSON.stringify for better readability
          result.failureMessages = result.failureMessages.map(message => {
            // Look for expect() assertion failures
            const expectMatch = message.match(/Expected: (.+)\n\s+Received: (.+)/);
            if (expectMatch) {
              try {
                // Try to parse and re-format with JSON.stringify
                const expected = expectMatch[1];
                const received = expectMatch[2];
                
                // Check if values look like objects/arrays
                if ((expected.startsWith('{') || expected.startsWith('[')) ||
                    (received.startsWith('{') || received.startsWith('['))) {
                  return message.replace(
                    /Expected: (.+)\n\s+Received: (.+)/,
                    `Expected: ${expected}\nReceived: ${received}\n\nFormatted:\nExpected:\n${this.tryFormat(expected)}\nReceived:\n${this.tryFormat(received)}`
                  );
                }
              } catch (e) {
                // If parsing fails, return original message
              }
            }
            return message;
          });
        }
      });
    }
  }

  tryFormat(value) {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(value);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      // If not valid JSON, try to evaluate as JavaScript object
      try {
        // eslint-disable-next-line no-eval
        const obj = eval('(' + value + ')');
        return JSON.stringify(obj, null, 2);
      } catch (e2) {
        // Return original if all formatting attempts fail
        return value;
      }
    }
  }
}

module.exports = JSONFormattedReporter;