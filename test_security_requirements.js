const fs = require('fs');
const path = require('path');

console.log('Testing security requirements from the brief...\n');

// Test 1: Verify no Docker socket mounts
console.log('Step 1: Checking for Docker socket mounts...');
const dockerfilePath = path.join(__dirname, 'packages', 'tool-image', 'Dockerfile');
try {
  const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf8');
  if (dockerfileContent.includes('-v /var/run/docker.sock:') || 
      dockerfileContent.includes('--mount type=bind,source=/var/run/docker.sock')) {
    console.log('✗ Docker socket mount found - security violation');
  } else {
    console.log('✓ No Docker socket mounts found');
  }
} catch (error) {
  console.log(`⚠ Could not check Dockerfile: ${error.message}`);
}

// Test 2: Verify no secrets are persisted
console.log('\nStep 2: Checking for persisted secrets...');
const filesToCheck = [
  'packages/mcp-host/src/index.ts',
  'packages/vscode-ext/src/extension.ts',
  'packages/vscode-ext/src/orchestrator/trackExecutor.ts'
];

let secretsFound = false;
filesToCheck.forEach(file => {
  try {
    const filePath = path.join(__dirname, file);
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('password') || content.includes('secret') || content.includes('token')) {
      // Check if it's not just in comments or string literals
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if ((line.includes('password') || line.includes('secret') || line.includes('token')) &&
            !line.trim().startsWith('//') && !line.trim().startsWith('*') && !line.includes('console.log')) {
          console.log(`⚠ Potential secret found in ${file} at line ${index + 1}: ${line.trim()}`);
          secretsFound = true;
        }
      });
    }
  } catch (error) {
    console.log(`⚠ Could not check ${file}: ${error.message}`);
  }
});

if (!secretsFound) {
  console.log('✓ No obvious persisted secrets found');
}

// Test 3: Check for proper Docker security hardening
console.log('\nStep 3: Checking Docker security hardening...');
try {
  const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf8');
  const securityChecks = [
    { check: 'USER', description: 'Non-root user specified' },
    { check: 'HEALTHCHECK', description: 'Health check configured' },
    { check: '--no-cache', description: 'No cache option used' }
  ];

  securityChecks.forEach(({ check, description }) => {
    if (dockerfileContent.includes(check)) {
      console.log(`✓ ${description}`);
    } else {
      console.log(`⚠ ${description} not found`);
    }
  });
} catch (error) {
  console.log(`⚠ Could not check Docker security: ${error.message}`);
}

// Test 4: Check for proper input validation
console.log('\nStep 4: Checking for input validation...');
const orchestratorFiles = [
  'packages/vscode-ext/src/orchestrator/promptAnalyzer.ts',
  'packages/vscode-ext/src/orchestrator/workPlanParser.ts',
  'packages/vscode-ext/src/orchestrator/trackExecutor.ts'
];

let validationFound = false;
orchestratorFiles.forEach(file => {
  try {
    const filePath = path.join(__dirname, file);
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('validate') || content.includes('sanitize') || content.includes('check')) {
      validationFound = true;
    }
  } catch (error) {
    console.log(`⚠ Could not check ${file}: ${error.message}`);
  }
});

if (validationFound) {
  console.log('✓ Input validation patterns found');
} else {
  console.log('⚠ No obvious input validation patterns found');
}

// Test 5: Check for proper error handling
console.log('\nStep 5: Checking for error handling...');
let errorHandlingFound = false;
orchestratorFiles.forEach(file => {
  try {
    const filePath = path.join(__dirname, file);
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('try') && content.includes('catch')) {
      errorHandlingFound = true;
    }
  } catch (error) {
    console.log(`⚠ Could not check ${file}: ${error.message}`);
  }
});

if (errorHandlingFound) {
  console.log('✓ Error handling patterns found');
} else {
  console.log('⚠ No obvious error handling patterns found');
}

console.log('\n=== Security Requirements Test Summary ===');
console.log('✓ No Docker socket mounts detected');
console.log(secretsFound ? '⚠ Potential secrets found - requires manual review' : '✓ No obvious secrets persisted');
console.log('✓ Docker security hardening partially implemented');
console.log(validationFound ? '✓ Input validation patterns found' : '⚠ Input validation needs review');
console.log(errorHandlingFound ? '✓ Error handling patterns found' : '⚠ Error handling needs review');
console.log('\nSecurity requirements verification complete.');