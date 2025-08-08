import { Logger } from './logger';
import { ErrorHandler, CircuitBreaker, CircuitBreakerConfig } from './errorHandler';

const logger = new Logger('RetryHandler');

export interface RetryConfig {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffFactor: number;
    jitter?: boolean;
}

export interface RetryOptions {
    context?: string;
    onRetry?: (error: any, attempt: number, delay: number) => void;
    shouldRetry?: (error: any) => boolean;
}

export interface RetryResult<T> {
    success: boolean;
    data?: T;
    error?: any;
    attempts: number;
    totalTimeMs: number;
}

export class RetryHandler {
    private static defaultConfig: RetryConfig = {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        backoffFactor: 2,
        jitter: true
    };

    /**
     * Execute a function with retry logic
     * @param fn The function to execute
     * @param config Retry configuration
     * @param options Retry options
     * @returns Promise that resolves with the retry result
     */
    public static async executeWithRetry<T>(
        fn: () => Promise<T>,
        config: Partial<RetryConfig> = {},
        options: RetryOptions = {}
    ): Promise<RetryResult<T>> {
        const startTime = Date.now();
        const finalConfig = { ...this.defaultConfig, ...config };
        let lastError: any = null;
        let attempts = 0;

        for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
            attempts = attempt + 1;
            
            try {
                const result = await fn();
                return {
                    success: true,
                    data: result,
                    attempts,
                    totalTimeMs: Date.now() - startTime
                };
            } catch (error: any) {
                lastError = error;
                
                // Check if we should retry
                if (attempt === finalConfig.maxRetries || 
                    (options.shouldRetry && !options.shouldRetry(error))) {
                    break;
                }

                // Calculate delay with exponential backoff
                const delay = this.calculateDelay(finalConfig, attempt);
                
                // Log retry attempt
                logger.warn(`Attempt ${attempt + 1}/${finalConfig.maxRetries} failed. Retrying in ${delay}ms...`);
                
                // Call onRetry callback if provided
                if (options.onRetry) {
                    options.onRetry(error, attempt + 1, delay);
                }

                // Wait before retry
                await this.delay(delay);
            }
        }

        // All retries failed
        const errorMessage = lastError?.message || 'Unknown error';
        logger.error(`Operation failed after ${attempts} attempts: ${errorMessage}`);
        
        if (options.context) {
            ErrorHandler.handleError(lastError, {
                showUser: false,
                logLevel: 'error',
                context: options.context
            });
        }

        return {
            success: false,
            error: lastError,
            attempts,
            totalTimeMs: Date.now() - startTime
        };
    }

    /**
     * Execute a function with retry logic and circuit breaker protection
     * @param fn The function to execute
     * @param resourceId The resource ID for the circuit breaker
     * @param retryConfig Retry configuration
     * @param circuitConfig Circuit breaker configuration
     * @param options Retry options
     * @returns Promise that resolves with the retry result
     */
    public static async executeWithRetryAndCircuitBreaker<T>(
        fn: () => Promise<T>,
        resourceId: string,
        retryConfig: Partial<RetryConfig> = {},
        circuitConfig: CircuitBreakerConfig = {},
        options: RetryOptions = {}
    ): Promise<RetryResult<T>> {
        const circuitBreaker = ErrorHandler.getCircuitBreaker(resourceId, circuitConfig);
        
        try {
            const result = await circuitBreaker.execute(async () => {
                return await this.executeWithRetry(fn, retryConfig, options);
            });
            
            return result;
        } catch (error: any) {
            // Circuit breaker is open
            logger.error(`Circuit breaker is OPEN for resource: ${resourceId}`);
            
            if (options.context) {
                ErrorHandler.handleError(error, {
                    showUser: false,
                    logLevel: 'error',
                    context: options.context
                });
            }

            return {
                success: false,
                error,
                attempts: 0,
                totalTimeMs: 0
            };
        }
    }

    /**
     * Calculate delay with exponential backoff and optional jitter
     * @param config Retry configuration
     * @param attempt Current attempt number (0-based)
     * @returns Delay in milliseconds
     */
    private static calculateDelay(config: RetryConfig, attempt: number): number {
        let delay = config.initialDelayMs * Math.pow(config.backoffFactor, attempt);
        delay = Math.min(delay, config.maxDelayMs);
        
        // Add jitter to prevent thundering herd
        if (config.jitter) {
            delay = Math.floor(delay * (0.8 + Math.random() * 0.4)); // ±20% jitter
        }
        
        return delay;
    }

    /**
     * Delay execution for a specified amount of time
     * @param ms Delay in milliseconds
     * @returns Promise that resolves after the delay
     */
    private static delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Create a retry function with predefined configuration
     * @param config Retry configuration
     * @param options Retry options
     * @returns A function that executes another function with retry logic
     */
    public static createRetryFunction<T>(
        config: Partial<RetryConfig> = {},
        options: RetryOptions = {}
    ) {
        return (fn: () => Promise<T>) => this.executeWithRetry(fn, config, options);
    }

    /**
     * Create a retry function with circuit breaker protection
     * @param resourceId The resource ID for the circuit breaker
     * @param retryConfig Retry configuration
     * @param circuitConfig Circuit breaker configuration
     * @param options Retry options
     * @returns A function that executes another function with retry logic and circuit breaker protection
     */
    public static createRetryFunctionWithCircuitBreaker<T>(
        resourceId: string,
        retryConfig: Partial<RetryConfig> = {},
        circuitConfig: CircuitBreakerConfig = {},
        options: RetryOptions = {}
    ) {
        return (fn: () => Promise<T>) => 
            this.executeWithRetryAndCircuitBreaker(fn, resourceId, retryConfig, circuitConfig, options);
    }

    /**
     * Default predicate for determining if an error is retryable
     * @param error The error to evaluate
     * @returns True if the error is retryable
     */
    public static isRetryableError(error: any): boolean {
        const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
        
        // Network-related errors are usually retryable
        const retryablePatterns = [
            'connection refused',
            'timeout',
            'network error',
            'econnrefused',
            'econnreset',
            'etimedout',
            'temporary',
            'temporary failure',
            'resource temporarily unavailable',
            'service unavailable',
            'rate limit',
            'too many requests',
            'request timeout',
            'gateway timeout',
            'bad gateway'
        ];
        
        return retryablePatterns.some(pattern => errorMessage.includes(pattern));
    }

    /**
     * Create a retry configuration for specific scenarios
     * @param scenario The scenario type
     * @returns Retry configuration for the scenario
     */
    public static getConfigForScenario(scenario: 'network' | 'database' | 'file' | 'container'): Partial<RetryConfig> {
        switch (scenario) {
            case 'network':
                return {
                    maxRetries: 5,
                    initialDelayMs: 1000,
                    maxDelayMs: 60000,
                    backoffFactor: 2,
                    jitter: true
                };
            case 'database':
                return {
                    maxRetries: 3,
                    initialDelayMs: 500,
                    maxDelayMs: 10000,
                    backoffFactor: 2,
                    jitter: false
                };
            case 'file':
                return {
                    maxRetries: 2,
                    initialDelayMs: 100,
                    maxDelayMs: 1000,
                    backoffFactor: 1.5,
                    jitter: false
                };
            case 'container':
                return {
                    maxRetries: 3,
                    initialDelayMs: 2000,
                    maxDelayMs: 30000,
                    backoffFactor: 2,
                    jitter: true
                };
            default:
                return {};
        }
    }
}