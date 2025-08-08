const assert = require('assert');
const { greet } = require('./index'); // This will cause an error because greet is not exported

try {
    // This test will fail because greet is not exported
    assert.strictEqual(typeof greet, 'function', 'greet should be a function');
    console.log('Test passed: greet is a function');
} catch (error) {
    console.error('Test failed:', error.message);
}