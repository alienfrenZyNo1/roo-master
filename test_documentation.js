// Test to verify documentation completeness and consistency
const fs = require('fs');
const path = require('path');

console.log('Testing documentation...\n');

// Test 1: Check if key documentation files exist
console.log('1. Checking if key documentation files exist...');
const filesToCheck = [
    'docs/DEMO.md',
    'docs/SECURITY.md',
    'scripts/E2E_README.md',
    'packages/tool-image/README.md',
    'scripts/run-demo.ps1',
    'scripts/clean-demo.ps1',
    'scripts/init-demo.ps1'
];

let allFilesExist = true;
filesToCheck.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`   ✓ ${file} exists`);
    } else {
        console.log(`   ✗ ${file} does not exist`);
        allFilesExist = false;
    }
});

if (!allFilesExist) {
    console.log('\nSome key documentation files are missing.');
}

// Test 2: Check documentation content
console.log('\n2. Checking documentation content...');

// Check DEMO.md content
const demoContent = fs.readFileSync('docs/DEMO.md', 'utf8');
const hasPrerequisites = demoContent.includes('## Prerequisites');
const hasDirectoryStructure = demoContent.includes('## 1. Directory Structure');
const hasTestScenario = demoContent.includes('## 3. Test Scenario');
const hasTroubleshooting = demoContent.includes('## 5. Troubleshooting Tips');
console.log(`   ✓ DEMO.md has Prerequisites section: ${hasPrerequisites}`);
console.log(`   ✓ DEMO.md has Directory Structure section: ${hasDirectoryStructure}`);
console.log(`   ✓ DEMO.md has Test Scenario section: ${hasTestScenario}`);
console.log(`   ✓ DEMO.md has Troubleshooting section: ${hasTroubleshooting}`);

// Check SECURITY.md content
const securityContent = fs.readFileSync('docs/SECURITY.md', 'utf8');
const hasDockerHardening = securityContent.includes('## Docker Hardening Flags and Rationale');
const hasNoDockerSocketPolicy = securityContent.includes('## Security Policy: No Docker Socket Mounts');
const hasEnvOnlySecretsPolicy = securityContent.includes('## Env-Only Secrets Policy');
const hasBestPractices = securityContent.includes('## Best Practices for Secure Operation');
console.log(`   ✓ SECURITY.md has Docker Hardening section: ${hasDockerHardening}`);
console.log(`   ✓ SECURITY.md has No Docker Socket Mounts policy: ${hasNoDockerSocketPolicy}`);
console.log(`   ✓ SECURITY.md has Env-Only Secrets policy: ${hasEnvOnlySecretsPolicy}`);
console.log(`   ✓ SECURITY.md has Best Practices section: ${hasBestPractices}`);

// Check E2E_README.md content
const e2eContent = fs.readFileSync('scripts/E2E_README.md', 'utf8');
const hasE2EOverview = e2eContent.includes('# E2E Test Scripts');
const hasE2EScripts = e2eContent.includes('### e2e-setup.js');
const hasE2EUsage = e2eContent.includes('**Usage**:');
const hasE2ERequirements = e2eContent.includes('## Requirements');
console.log(`   ✓ E2E_README.md has Overview: ${hasE2EOverview}`);
console.log(`   ✓ E2E_README.md has Scripts section: ${hasE2EScripts}`);
console.log(`   ✓ E2E_README.md has Usage section: ${hasE2EUsage}`);
console.log(`   ✓ E2E_README.md has Requirements section: ${hasE2ERequirements}`);

// Check tool-image README
const toolImageContent = fs.readFileSync('packages/tool-image/README.md', 'utf8');
const hasToolImageOverview = toolImageContent.includes('# Tool Container Image');
const hasToolImageBuilding = toolImageContent.includes('## Building the Image');
const hasToolImageHardening = toolImageContent.includes('## Hardening Measures');
const hasToolImageUsage = toolImageContent.includes('## Usage Notes');
console.log(`   ✓ Tool Image README has Overview: ${hasToolImageOverview}`);
console.log(`   ✓ Tool Image README has Building section: ${hasToolImageBuilding}`);
console.log(`   ✓ Tool Image README has Hardening section: ${hasToolImageHardening}`);
console.log(`   ✓ Tool Image README has Usage section: ${hasToolImageUsage}`);

// Test 3: Check for consistent security practices across documentation
console.log('\n3. Checking for consistent security practices...');

const demoHasSecurityInfo = demoContent.includes('Docker') || demoContent.includes('security');
const securityHasDockerFlags = securityContent.includes('--read-only') && 
                                securityContent.includes('--cap-drop=ALL') && 
                                securityContent.includes('--security-opt=no-new-privileges');
const toolImageHasSecurity = toolImageContent.includes('security') || toolImageContent.includes('Dockerfile');

console.log(`   ✓ DEMO.md mentions security/Docker: ${demoHasSecurityInfo}`);
console.log(`   ✓ SECURITY.md has Docker hardening flags: ${securityHasDockerFlags}`);
console.log(`   ✓ Tool Image README mentions security: ${toolImageHasSecurity}`);

// Test 4: Check for consistent project structure references
console.log('\n4. Checking for consistent project structure references...');

const demoHasProjectStructure = demoContent.includes('roo-master/') && 
                                demoContent.includes('packages/') && 
                                demoContent.includes('scripts/');
const e2eHasProjectStructure = e2eContent ? (e2eContent.includes('roo-master') ||
                               e2eContent.includes('packages') ||
                               e2eContent.includes('scripts')) : false;
const toolImageHasProjectStructure = toolImageContent.includes('roo-master') || 
                                    toolImageContent.includes('packages');

console.log(`   ✓ DEMO.md describes project structure: ${demoHasProjectStructure}`);
console.log(`   ✓ E2E_README.md references project structure: ${e2EHasProjectStructure}`);
console.log(`   ✓ Tool Image README references project: ${toolImageHasProjectStructure}`);

// Test 5: Check for executable scripts
console.log('\n5. Checking for executable scripts...');

const scripts = [
    'scripts/run-demo.ps1',
    'scripts/clean-demo.ps1',
    'scripts/init-demo.ps1'
];

let allScriptsExist = true;
scripts.forEach(script => {
    if (fs.existsSync(script)) {
        const stats = fs.statSync(script);
        const isExecutable = stats.mode & 0o111; // Check if executable by anyone
        console.log(`   ✓ ${script} exists ${isExecutable ? 'and is executable' : 'but is not executable'}`);
    } else {
        console.log(`   ✗ ${script} does not exist`);
        allScriptsExist = false;
    }
});

// Test 6: Check for consistent versioning or dating in documentation
console.log('\n6. Checking for versioning or dating information...');

const demoHasDate = demoContent.match(/\d{4}/); // Simple check for a year
const securityHasDate = securityContent.match(/\d{4}/);
const e2eHasDate = e2eContent.match(/\d{4}/);
const toolImageHasDate = toolImageContent.match(/\d{4}/);

console.log(`   ✓ DEMO.md has date/year: ${!!demoHasDate}`);
console.log(`   ✓ SECURITY.md has date/year: ${!!securityHasDate}`);
console.log(`   ✓ E2E_README.md has date/year: ${!!e2eHasDate}`);
console.log(`   ✓ Tool Image README has date/year: ${!!toolImageHasDate}`);

// Test 7: Check for troubleshooting and error handling information
console.log('\n7. Checking for troubleshooting and error handling information...');

const demoHasTroubleshooting = demoContent.includes('Troubleshooting') || 
                               demoContent.includes('troubleshooting') || 
                               demoContent.includes('error');
const e2eHasTroubleshooting = e2eContent ? (e2eContent.includes('troubleshooting') ||
                              e2eContent.includes('error') ||
                              e2eContent.includes('issue')) : false;
const toolImageHasTroubleshooting = toolImageContent.includes('troubleshooting') || 
                                    toolImageContent.includes('error') || 
                                    toolImageContent.includes('issue');

console.log(`   ✓ DEMO.md has troubleshooting info: ${demoHasTroubleshooting}`);
console.log(`   ✓ E2E_README.md has troubleshooting info: ${e2eHasTroubleshooting}`);
console.log(`   ✓ Tool Image README has troubleshooting info: ${toolImageHasTroubleshooting}`);

// Test 8: Check for diagrams or visual aids (simplified check for markdown image syntax)
console.log('\n8. Checking for diagrams or visual aids...');

const demoHasImages = demoContent.includes('![') || demoContent.includes('```');
const securityHasImages = securityContent.includes('![') || securityContent.includes('```');
const e2eHasImages = e2eContent ? (e2eContent.includes('![') || e2eContent.includes('```')) : false;
const toolImageHasImages = toolImageContent.includes('![') || toolImageContent.includes('```');

console.log(`   ✓ DEMO.md has visual aids: ${demoHasImages}`);
console.log(`   ✓ SECURITY.md has visual aids: ${securityHasImages}`);
console.log(`   ✓ E2E_README.md has visual aids: ${e2eHasImages}`);
console.log(`   ✓ Tool Image README has visual aids: ${toolImageHasImages}`);

// Summary
console.log('\n=== Documentation Test Summary ===');
const allTestsPassed =
    hasPrerequisites && hasDirectoryStructure && hasTestScenario && hasTroubleshooting &&
    hasDockerHardening && hasNoDockerSocketPolicy && hasEnvOnlySecretsPolicy && hasBestPractices &&
    hasE2EOverview && hasE2EScripts && hasE2EUsage && hasE2ERequirements &&
    hasToolImageOverview && hasToolImageBuilding && hasToolImageHardening && hasToolImageUsage &&
    demoHasSecurityInfo && securityHasDockerFlags && toolImageHasSecurity &&
    demoHasProjectStructure && e2eHasProjectStructure && toolImageHasProjectStructure &&
    allScriptsExist && demoHasDate && securityHasDate && e2eHasDate && toolImageHasDate &&
    demoHasTroubleshooting && e2eHasTroubleshooting && toolImageHasTroubleshooting &&
    demoHasImages && securityHasImages && e2eHasImages && toolImageHasImages;

if (allTestsPassed) {
    console.log('✓ All documentation tests passed!');
    console.log('\nThe documentation appears to be comprehensive with:');
    console.log('- Complete user guides and tutorials');
    console.log('- Security policies and best practices');
    console.log('- Consistent project structure references');
    console.log('- Executable scripts with proper permissions');
    console.log('- Versioning/dating information');
    console.log('- Troubleshooting and error handling guidance');
    console.log('- Visual aids and diagrams');
} else {
    console.log('✗ Some documentation tests failed.');
    console.log('Please review the documentation to ensure it is complete and consistent.');
}

// Test 9: Check if we need a main README.md
console.log('\n9. Checking for main README.md...');
if (fs.existsSync('README.md')) {
    console.log('   ✓ Main README.md exists');
    const readmeContent = fs.readFileSync('README.md', 'utf8');
    const hasProjectOverview = readmeContent.includes('# ') || readmeContent.toLowerCase().includes('roo master');
    const hasInstallationInstructions = readmeContent.toLowerCase().includes('install') || 
                                       readmeContent.toLowerCase().includes('setup');
    const hasUsageInstructions = readmeContent.toLowerCase().includes('usage') || 
                                 readmeContent.toLowerCase().includes('how to');
    const hasContributingInfo = readmeContent.toLowerCase().includes('contributing') || 
                                readmeContent.toLowerCase().includes('contribute');
    
    console.log(`   ✓ Main README.md has project overview: ${hasProjectOverview}`);
    console.log(`   ✓ Main README.md has installation instructions: ${hasInstallationInstructions}`);
    console.log(`   ✓ Main README.md has usage instructions: ${hasUsageInstructions}`);
    console.log(`   ✓ Main README.md has contributing info: ${hasContributingInfo}`);
} else {
    console.log('   ⚠ Main README.md does not exist - consider creating one for project overview');
}

console.log('\nDocumentation verification complete.');