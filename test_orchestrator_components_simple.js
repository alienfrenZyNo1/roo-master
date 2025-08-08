// Simple test to verify the orchestrator components structure
const fs = require('fs');
const path = require('path');

console.log('Testing orchestrator components...\n');

// Test 1: Check if files exist
console.log('1. Checking if orchestrator component files exist...');
const filesToCheck = [
    'packages/vscode-ext/src/orchestrator/promptAnalyzer.ts',
    'packages/vscode-ext/src/orchestrator/workPlanParser.ts',
    'packages/vscode-ext/src/orchestrator/trackExecutor.ts'
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
    console.log('\nSome orchestrator component files are missing. Aborting tests.');
    process.exit(1);
}

// Test 2: Check file contents for key classes and methods
console.log('\n2. Checking file contents for key classes and methods...');

const promptAnalyzerContent = fs.readFileSync('packages/vscode-ext/src/orchestrator/promptAnalyzer.ts', 'utf8');
const workPlanParserContent = fs.readFileSync('packages/vscode-ext/src/orchestrator/workPlanParser.ts', 'utf8');
const trackExecutorContent = fs.readFileSync('packages/vscode-ext/src/orchestrator/trackExecutor.ts', 'utf8');

// Check PromptAnalyzer
const hasPromptAnalyzerClass = promptAnalyzerContent.includes('export class PromptAnalyzer');
const hasAnalyzePromptMethod = promptAnalyzerContent.includes('public async analyzePrompt(prompt: string)');
console.log(`   ✓ PromptAnalyzer class exists: ${hasPromptAnalyzerClass}`);
console.log(`   ✓ analyzePrompt method exists: ${hasAnalyzePromptMethod}`);

// Check WorkPlanParser
const hasWorkPlanParserClass = workPlanParserContent.includes('export class WorkPlanParser');
const hasParsePromptToWorkPlanMethod = workPlanParserContent.includes('public async parsePromptToWorkPlan(prompt: string');
console.log(`   ✓ WorkPlanParser class exists: ${hasWorkPlanParserClass}`);
console.log(`   ✓ parsePromptToWorkPlan method exists: ${hasParsePromptToWorkPlanMethod}`);

// Check TrackExecutor
const hasTrackExecutorClass = trackExecutorContent.includes('export class TrackExecutor');
const hasExecuteWorkPlanMethod = trackExecutorContent.includes('public async executeWorkPlan(workPlan: WorkPlan)');
console.log(`   ✓ TrackExecutor class exists: ${hasTrackExecutorClass}`);
console.log(`   ✓ executeWorkPlan method exists: ${hasExecuteWorkPlanMethod}`);

// Test 3: Check for key interfaces and types
console.log('\n3. Checking for key interfaces and types...');

const hasTrackInterface = workPlanParserContent.includes('export interface Track');
const hasWorkPlanInterface = workPlanParserContent.includes('export interface WorkPlan');
const hasPromptAnalysisResultInterface = promptAnalyzerContent.includes('export interface PromptAnalysisResult');
const hasTrackExecutionResultInterface = trackExecutorContent.includes('export interface TrackExecutionResult');

console.log(`   ✓ Track interface exists: ${hasTrackInterface}`);
console.log(`   ✓ WorkPlan interface exists: ${hasWorkPlanInterface}`);
console.log(`   ✓ PromptAnalysisResult interface exists: ${hasPromptAnalysisResultInterface}`);
console.log(`   ✓ TrackExecutionResult interface exists: ${hasTrackExecutionResultInterface}`);

// Test 4: Check for dependency injection and integration points
console.log('\n4. Checking for dependency injection and integration points...');

const hasWorkPlanParserInPromptAnalyzer = promptAnalyzerContent.includes('private workPlanParser: WorkPlanParser');
const hasGitWorktreeInTrackExecutor = trackExecutorContent.includes('import { GitWorktree } from');
const hasMcpLauncherInTrackExecutor = trackExecutorContent.includes('import { McpServerLauncher } from');
const hasDockerInTrackExecutor = trackExecutorContent.includes('import { startToolContainer, stopToolContainer } from');

console.log(`   ✓ WorkPlanParser dependency in PromptAnalyzer: ${hasWorkPlanParserInPromptAnalyzer}`);
console.log(`   ✓ GitWorktree dependency in TrackExecutor: ${hasGitWorktreeInTrackExecutor}`);
console.log(`   ✓ McpServerLauncher dependency in TrackExecutor: ${hasMcpLauncherInTrackExecutor}`);
console.log(`   ✓ Docker dependency in TrackExecutor: ${hasDockerInTrackExecutor}`);

// Test 5: Check for error handling and retry logic
console.log('\n5. Checking for error handling and retry logic...');

const hasErrorHandlerInPromptAnalyzer = promptAnalyzerContent.includes('ErrorHandler.handleError');
const hasErrorHandlerInWorkPlanParser = workPlanParserContent.includes('ErrorHandler.handleError');
const hasErrorHandlerInTrackExecutor = trackExecutorContent.includes('ErrorHandler.handleError');
const hasRetryLogicInTrackExecutor = trackExecutorContent.includes('RETRY_CONFIG');
const hasCircuitBreakerInTrackExecutor = trackExecutorContent.includes('getCircuitBreaker');

console.log(`   ✓ Error handling in PromptAnalyzer: ${hasErrorHandlerInPromptAnalyzer}`);
console.log(`   ✓ Error handling in WorkPlanParser: ${hasErrorHandlerInWorkPlanParser}`);
console.log(`   ✓ Error handling in TrackExecutor: ${hasErrorHandlerInTrackExecutor}`);
console.log(`   ✓ Retry logic in TrackExecutor: ${hasRetryLogicInTrackExecutor}`);
console.log(`   ✓ Circuit breaker in TrackExecutor: ${hasCircuitBreakerInTrackExecutor}`);

// Test 6: Check for progress reporting
console.log('\n6. Checking for progress reporting...');

const hasProgressReportInterface = trackExecutorContent.includes('export interface ProgressReport');
const hasProgressEmitter = trackExecutorContent.includes('private progressEmitter = new vscode.EventEmitter');
const hasOnProgressUpdate = trackExecutorContent.includes('public onProgressUpdate = this.progressEmitter.event');

console.log(`   ✓ ProgressReport interface exists: ${hasProgressReportInterface}`);
console.log(`   ✓ Progress emitter exists: ${hasProgressEmitter}`);
console.log(`   ✓ onProgressUpdate event exists: ${hasOnProgressUpdate}`);

// Test 7: Check for security configurations
console.log('\n7. Checking for security configurations...');

const hasContainerSecurityFlags = trackExecutorContent.includes('securityFlags');
const hasReadOnlyFlag = trackExecutorContent.includes('--read-only');
const hasCapDropAll = trackExecutorContent.includes('--cap-drop=ALL');
const hasNoNewPrivileges = trackExecutorContent.includes('--security-opt=no-new-privileges');

console.log(`   ✓ Container security flags: ${hasContainerSecurityFlags}`);
console.log(`   ✓ Read-only flag: ${hasReadOnlyFlag}`);
console.log(`   ✓ Cap-drop all: ${hasCapDropAll}`);
console.log(`   ✓ No new privileges: ${hasNoNewPrivileges}`);

// Summary
console.log('\n=== Orchestrator Components Test Summary ===');
const allTestsPassed = 
    hasPromptAnalyzerClass && hasAnalyzePromptMethod &&
    hasWorkPlanParserClass && hasParsePromptToWorkPlanMethod &&
    hasTrackExecutorClass && hasExecuteWorkPlanMethod &&
    hasTrackInterface && hasWorkPlanInterface && 
    hasPromptAnalysisResultInterface && hasTrackExecutionResultInterface &&
    hasWorkPlanParserInPromptAnalyzer && hasGitWorktreeInTrackExecutor &&
    hasMcpLauncherInTrackExecutor && hasDockerInTrackExecutor &&
    hasErrorHandlerInPromptAnalyzer && hasErrorHandlerInWorkPlanParser &&
    hasErrorHandlerInTrackExecutor && hasRetryLogicInTrackExecutor &&
    hasCircuitBreakerInTrackExecutor && hasProgressReportInterface &&
    hasProgressEmitter && hasOnProgressUpdate && hasContainerSecurityFlags &&
    hasReadOnlyFlag && hasCapDropAll && hasNoNewPrivileges;

if (allTestsPassed) {
    console.log('✓ All orchestrator component tests passed!');
    console.log('\nThe orchestrator components appear to be properly structured with:');
    console.log('- Proper class definitions and methods');
    console.log('- Required interfaces and types');
    console.log('- Dependency injection patterns');
    console.log('- Error handling and retry logic');
    console.log('- Progress reporting mechanisms');
    console.log('- Security configurations for containers');
} else {
    console.log('✗ Some orchestrator component tests failed.');
    console.log('Please review the implementation to ensure all components are properly integrated.');
}

console.log('\nOrchestrator component verification complete.');