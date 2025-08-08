import * as vscode from 'vscode';
import { Logger } from './logger';

const logger = new Logger('ErrorHandler');

export interface ErrorOptions {
    showUser?: boolean;
    logLevel?: 'info' | 'warn' | 'error' | 'debug';
    userMessage?: string;
    context?: string;
    recoveryActions?: RecoveryAction[];
}

export interface RecoveryAction {
    id: string;
    label: string;
    callback: () => Promise<boolean>;
    description?: string;
}

export interface ErrorContext {
    component: string;
    operation?: string;
    timestamp: number;
    errorId: string;
    recoveryAttempted?: boolean;
    recoverySuccessful?: boolean;
}

/**
 * Interface for recovery strategies
 */
export interface RecoveryStrategy {
    name: string;
    description: string;
    canHandle(error: Error | string): boolean;
    appliesToContext(context: string): boolean;
    recover(error: Error | string, context: ErrorContext): Promise<boolean>;
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
    failureThreshold?: number;
    resetTimeout?: number;
    monitoringPeriod?: number;
    expectedExceptionPredicate?: (error: any) => boolean;
}

/**
 * Circuit breaker states
 */
enum CircuitState {
    CLOSED,
    OPEN,
    HALF_OPEN
}

/**
 * Circuit breaker implementation for preventing cascading failures
 */
export class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failureCount: number = 0;
    private lastFailureTime: number = 0;
    private nextAttemptTime: number = 0;

    constructor(
        public readonly resourceId: string,
        private config: CircuitBreakerConfig = {}
    ) {
        this.config = {
            failureThreshold: config.failureThreshold || 5,
            resetTimeout: config.resetTimeout || 60000, // 1 minute
            monitoringPeriod: config.monitoringPeriod || 60000, // 1 minute
            expectedExceptionPredicate: config.expectedExceptionPredicate || (() => true)
        };
    }

    /**
     * Executes an action with circuit breaker protection
     * @param action The action to execute
     * @returns Promise that resolves with the action result
     */
    public async execute<T>(action: () => Promise<T>): Promise<T> {
        if (this.state === CircuitState.OPEN) {
            if (Date.now() < this.nextAttemptTime) {
                throw new Error(`Circuit breaker is OPEN for resource: ${this.resourceId}`);
            } else {
                this.transitionToHalfOpen();
            }
        }

        try {
            const result = await action();
            this.onSuccess();
            return result;
        } catch (error: any) {
            await this.onFailure(error);
            throw error;
        }
    }

    /**
     * Handles successful execution
     */
    private onSuccess(): void {
        this.failureCount = 0;
        if (this.state === CircuitState.HALF_OPEN) {
            this.transitionToClosed();
        }
    }

    /**
     * Handles failed execution
     * @param error The error that occurred
     */
    private async onFailure(error: any): Promise<void> {
        if (!this.config.expectedExceptionPredicate!(error)) {
            return; // Don't count unexpected exceptions as failures
        }

        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.shouldOpenCircuit()) {
            this.transitionToOpen();
        }
    }

    /**
     * Determines if the circuit should be opened
     * @returns True if the circuit should be opened
     */
    private shouldOpenCircuit(): boolean {
        return (
            this.failureCount >= this.config.failureThreshold! &&
            (Date.now() - this.lastFailureTime) <= this.config.monitoringPeriod!
        );
    }

    /**
     * Transitions the circuit to CLOSED state
     */
    private transitionToClosed(): void {
        this.state = CircuitState.CLOSED;
        logger.info(`Circuit breaker CLOSED for resource: ${this.resourceId}`);
    }

    /**
     * Transitions the circuit to OPEN state
     */
    private transitionToOpen(): void {
        this.state = CircuitState.OPEN;
        this.nextAttemptTime = Date.now() + this.config.resetTimeout!;
        logger.warn(`Circuit breaker OPEN for resource: ${this.resourceId}`);
    }

    /**
     * Transitions the circuit to HALF_OPEN state
     */
    private transitionToHalfOpen(): void {
        this.state = CircuitState.HALF_OPEN;
        logger.info(`Circuit breaker HALF_OPEN for resource: ${this.resourceId}`);
    }

    /**
     * Gets the current state of the circuit breaker
     * @returns The current circuit state
     */
    public getState(): CircuitState {
        return this.state;
    }

    /**
     * Gets the failure count
     * @returns The number of failures
     */
    public getFailureCount(): number {
        return this.failureCount;
    }

    /**
     * Resets the circuit breaker
     */
    public reset(): void {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.lastFailureTime = 0;
        this.nextAttemptTime = 0;
        logger.info(`Circuit breaker RESET for resource: ${this.resourceId}`);
    }
}

/**
 * Centralized error handling for the extension
 */
export class ErrorHandler {
    private static errorHistory: Map<string, ErrorContext> = new Map();
    private static recoveryStrategies: Map<string, RecoveryStrategy> = new Map();
    private static circuitBreakers: Map<string, CircuitBreaker> = new Map();

    /**
     * Handle an error with consistent logging and user notification
     * @param error The error to handle
     * @param options Error handling options
     */
    public static async handleError(error: Error | string, options: ErrorOptions = {}): Promise<void> {
        const {
            showUser = true,
            logLevel = 'error',
            userMessage,
            context = 'Extension',
            recoveryActions = []
        } = options;

        const errorMessage = error instanceof Error ? error.message : error;
        const fullContext = context ? `[${context}]` : '';
        const errorId = this.generateErrorId(error, context);
        const errorContext: ErrorContext = {
            component: context,
            timestamp: Date.now(),
            errorId,
        };

        // Store error context for tracking
        this.errorHistory.set(errorId, errorContext);

        // Log the error with appropriate level
        switch (logLevel) {
            case 'info':
                logger.info(`${fullContext} ${errorMessage}`);
                break;
            case 'warn':
                logger.warn(`${fullContext} ${errorMessage}`);
                break;
            case 'debug':
                logger.debug(`${fullContext} ${errorMessage}`);
                break;
            case 'error':
            default:
                logger.error(`${fullContext} ${errorMessage}`);
                break;
        }

        // Show error to user if requested
        if (showUser) {
            const displayMessage = userMessage || errorMessage;
            
            if (recoveryActions.length > 0) {
                // Show error with recovery actions
                await this.showErrorWithRecoveryActions(displayMessage, recoveryActions, errorContext);
            } else {
                // Try to find automatic recovery strategies
                const autoRecoveryActions = this.findRecoveryStrategies(error, context);
                if (autoRecoveryActions.length > 0) {
                    await this.attemptAutomaticRecovery(error, autoRecoveryActions, errorContext);
                } else {
                    vscode.window.showErrorMessage(displayMessage);
                }
            }
        }
    }

    /**
     * Shows an error message with recovery actions to the user
     * @param message The error message to display
     * @param actions Available recovery actions
     * @param errorContext The error context
     */
    private static async showErrorWithRecoveryActions(
        message: string,
        actions: RecoveryAction[],
        errorContext: ErrorContext
    ): Promise<void> {
        const actionItems = actions.map(action => action.label);
        actionItems.push('Dismiss'); // Always add dismiss option

        const selectedAction = await vscode.window.showErrorMessage(message, ...actionItems);
        
        if (selectedAction && selectedAction !== 'Dismiss') {
            const action = actions.find(a => a.label === selectedAction);
            if (action) {
                try {
                    const success = await action.callback();
                    errorContext.recoveryAttempted = true;
                    errorContext.recoverySuccessful = success;
                    
                    if (success) {
                        vscode.window.showInformationMessage('Recovery action completed successfully.');
                    } else {
                        vscode.window.showWarningMessage('Recovery action failed. Please try again or check logs.');
                    }
                } catch (recoveryError: any) {
                    vscode.window.showErrorMessage(`Recovery action failed: ${recoveryError.message}`);
                }
            }
        }
    }

    /**
     * Attempts automatic recovery for an error
     * @param error The error that occurred
     * @param strategies Available recovery strategies
     * @param errorContext The error context
     */
    private static async attemptAutomaticRecovery(
        error: Error | string,
        strategies: RecoveryStrategy[],
        errorContext: ErrorContext
    ): Promise<void> {
        for (const strategy of strategies) {
            try {
                if (strategy.canHandle(error)) {
                    logger.info(`Attempting automatic recovery using strategy: ${strategy.name}`);
                    const success = await strategy.recover(error, errorContext);
                    
                    errorContext.recoveryAttempted = true;
                    errorContext.recoverySuccessful = success;
                    
                    if (success) {
                        vscode.window.showInformationMessage(`Automatically recovered from error: ${strategy.description}`);
                        return;
                    } else {
                        logger.warn(`Automatic recovery failed using strategy: ${strategy.name}`);
                    }
                }
            } catch (recoveryError: any) {
                logger.error(`Error during automatic recovery: ${recoveryError.message}`);
            }
        }

        // If automatic recovery failed, show the original error
        const errorMessage = error instanceof Error ? error.message : error;
        vscode.window.showErrorMessage(errorMessage);
    }

    /**
     * Finds recovery strategies for a given error
     * @param error The error to find strategies for
     * @param context The error context
     * @returns Array of applicable recovery strategies
     */
    private static findRecoveryStrategies(error: Error | string, context: string): RecoveryStrategy[] {
        const applicableStrategies: RecoveryStrategy[] = [];
        const errorMessage = error instanceof Error ? error.message : error;

        for (const [key, strategy] of this.recoveryStrategies) {
            if (strategy.canHandle(error) && strategy.appliesToContext(context)) {
                applicableStrategies.push(strategy);
            }
        }

        return applicableStrategies;
    }

    /**
     * Registers a recovery strategy
     * @param strategy The recovery strategy to register
     */
    public static registerRecoveryStrategy(strategy: RecoveryStrategy): void {
        this.recoveryStrategies.set(strategy.name, strategy);
    }

    /**
     * Gets or creates a circuit breaker for a given resource
     * @param resourceId The resource ID
     * @param config Circuit breaker configuration
     * @returns The circuit breaker instance
     */
    public static getCircuitBreaker(resourceId: string, config?: CircuitBreakerConfig): CircuitBreaker {
        if (!this.circuitBreakers.has(resourceId)) {
            const breaker = new CircuitBreaker(resourceId, config);
            this.circuitBreakers.set(resourceId, breaker);
        }
        return this.circuitBreakers.get(resourceId)!;
    }

    /**
     * Generates a unique error ID
     * @param error The error
     * @param context The error context
     * @returns A unique error ID
     */
    private static generateErrorId(error: Error | string, context: string): string {
        const errorMessage = error instanceof Error ? error.message : error;
        const timestamp = Date.now();
        const hash = this.simpleHash(`${context}:${errorMessage}:${timestamp}`);
        return `error_${hash}`;
    }

    /**
     * Simple hash function for generating IDs
     * @param str The string to hash
     * @returns A simple hash value
     */
    private static simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16);
    }

    /**
     * Gets error history
     * @returns Map of error IDs to error contexts
     */
    public static getErrorHistory(): Map<string, ErrorContext> {
        return new Map(this.errorHistory);
    }

    /**
     * Clears error history
     */
    public static clearErrorHistory(): void {
        this.errorHistory.clear();
    }

    /**
     * Validate that a value is not null or undefined
     * @param value The value to validate
     * @param paramName The name of the parameter (for error message)
     * @param context The context of the validation
     * @throws Error if validation fails
     */
    public static validateRequired(value: any, paramName: string, context?: string): void {
        if (value === null || value === undefined || value === '') {
            const errorMsg = `${paramName} is required`;
            this.handleError(errorMsg, {
                showUser: false,
                logLevel: 'warn',
                context
            });
            throw new Error(errorMsg);
        }
    }

    /**
     * Validate that a path exists and is accessible
     * @param path The path to validate
     * @param pathType The type of path (file, directory, etc.)
     * @param context The context of the validation
     * @throws Error if validation fails
     */
    public static validatePath(path: string, pathType: 'file' | 'directory' = 'file', context?: string): void {
        this.validateRequired(path, 'path', context);
        
        const fs = require('fs');
        
        if (!fs.existsSync(path)) {
            const errorMsg = `${pathType} path does not exist: ${path}`;
            this.handleError(errorMsg, {
                showUser: false,
                logLevel: 'warn',
                context
            });
            throw new Error(errorMsg);
        }

        const isDirectory = fs.statSync(path).isDirectory();
        if (pathType === 'directory' && !isDirectory) {
            const errorMsg = `Path is not a directory: ${path}`;
            this.handleError(errorMsg, {
                showUser: false,
                logLevel: 'warn',
                context
            });
            throw new Error(errorMsg);
        }

        if (pathType === 'file' && isDirectory) {
            const errorMsg = `Path is not a file: ${path}`;
            this.handleError(errorMsg, {
                showUser: false,
                logLevel: 'warn',
                context
            });
            throw new Error(errorMsg);
        }
    }

    /**
     * Wrap an async function with error handling
     * @param fn The function to wrap
     * @param context The context for error handling
     * @param userMessage Optional user message to show on error
     * @returns A new function with error handling
     */
    public static async wrapAsync<T>(
        fn: () => Promise<T>,
        context: string,
        userMessage?: string
    ): Promise<T> {
        try {
            return await fn();
        } catch (error: any) {
            this.handleError(error, {
                showUser: true,
                logLevel: 'error',
                userMessage,
                context
            });
            throw error; // Re-throw to allow caller to handle if needed
        }
    }

    /**
     * Create a standardized error response
     * @param message The error message
     * @param code Optional error code
     * @param details Optional error details
     * @returns A standardized error object
     */
    public static createError(
        message: string,
        code?: string,
        details?: any
    ): { success: false; error: { message: string; code?: string; details?: any } } {
        return {
            success: false,
            error: {
                message,
                code,
                details
            }
        };
    }

    /**
     * Create a standardized success response
     * @param data The success data
     * @returns A standardized success object
     */
    public static createSuccess<T>(data: T): { success: true; data: T } {
        return {
            success: true,
            data
        };
    }
}

/**
 * Common recovery strategies
 */
export class CommonRecoveryStrategies {
    /**
     * Retry strategy for transient failures
     */
    static readonly RetryStrategy: RecoveryStrategy = {
        name: 'retry',
        description: 'Retry the operation after a delay',
        canHandle: (error: Error | string) => {
            const errorMessage = error instanceof Error ? error.message : error;
            const transientPatterns = [
                /connection refused/i,
                /timeout/i,
                /network error/i,
                /temporary/i,
                /resource temporarily unavailable/i,
                /econnrefused/i,
                /econnreset/i,
                /etimedout/i
            ];
            return transientPatterns.some(pattern => pattern.test(errorMessage));
        },
        appliesToContext: (context: string) => {
            return true; // Applies to all contexts
        },
        recover: async (error: Error | string, context: ErrorContext) => {
            // This is a placeholder - actual retry logic should be implemented by the caller
            return false;
        }
    };

    /**
     * Cleanup resources strategy
     */
    static readonly CleanupStrategy: RecoveryStrategy = {
        name: 'cleanup',
        description: 'Clean up resources and retry',
        canHandle: (error: Error | string) => {
            const errorMessage = error instanceof Error ? error.message : error;
            return errorMessage.includes('already in use') ||
                   errorMessage.includes('resource busy') ||
                   errorMessage.includes('locked');
        },
        appliesToContext: (context: string) => {
            return context.includes('Container') ||
                   context.includes('Worktree') ||
                   context.includes('MCP');
        },
        recover: async (error: Error | string, context: ErrorContext) => {
            // This is a placeholder - actual cleanup logic should be implemented by the caller
            return false;
        }
    };

    /**
     * Reconnect strategy
     */
    static readonly ReconnectStrategy: RecoveryStrategy = {
        name: 'reconnect',
        description: 'Reconnect to the service',
        canHandle: (error: Error | string) => {
            const errorMessage = error instanceof Error ? error.message : error;
            return errorMessage.includes('connection lost') ||
                   errorMessage.includes('disconnected') ||
                   errorMessage.includes('connection reset');
        },
        appliesToContext: (context: string) => {
            return context.includes('MCP') ||
                   context.includes('Docker') ||
                   context.includes('Server');
        },
        recover: async (error: Error | string, context: ErrorContext) => {
            // This is a placeholder - actual reconnection logic should be implemented by the caller
            return false;
        }
    };

    /**
     * Fallback strategy
     */
    static readonly FallbackStrategy: RecoveryStrategy = {
        name: 'fallback',
        description: 'Use fallback mechanism',
        canHandle: (error: Error | string) => {
            const errorMessage = error instanceof Error ? error.message : error;
            return errorMessage.includes('unavailable') ||
                   errorMessage.includes('not found') ||
                   errorMessage.includes('service down');
        },
        appliesToContext: (context: string) => {
            return true; // Applies to all contexts
        },
        recover: async (error: Error | string, context: ErrorContext) => {
            // This is a placeholder - actual fallback logic should be implemented by the caller
            return false;
        }
    };
}

// Register common recovery strategies
ErrorHandler.registerRecoveryStrategy(CommonRecoveryStrategies.RetryStrategy);
ErrorHandler.registerRecoveryStrategy(CommonRecoveryStrategies.CleanupStrategy);
ErrorHandler.registerRecoveryStrategy(CommonRecoveryStrategies.ReconnectStrategy);
ErrorHandler.registerRecoveryStrategy(CommonRecoveryStrategies.FallbackStrategy);