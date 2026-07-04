/**
 * ErrorHandler.js - Middleware centralizzato per gestione errori
 * Implementa: retry logic, fallback strategies, error reporting
 */

import { logger } from '../utils/Logger';

class ErrorHandler {
  constructor() {
    this.errorStrategies = {};
    this.globalErrorHandlers = [];
  }

  /**
   * Registra strategia di errore personalizzata
   */
  registerErrorStrategy(errorType, handler) {
    this.errorStrategies[errorType] = handler;
  }

  /**
   * Registra handler globale per errori
   */
  registerGlobalHandler(handler) {
    this.globalErrorHandlers.push(handler);
  }

  /**
   * Gestisci errore con retry e fallback
   */
  async handleWithRetry(fn, options = {}) {
    const {
      maxAttempts = 3,
      baseDelay = 500,
      maxDelay = 5000,
      backoffMultiplier = 2,
      onRetry = null,
      module = 'Unknown',
    } = options;

    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        logger.debug(module, `Attempt ${attempt}/${maxAttempts}`);
        return await fn();
      } catch (error) {
        lastError = error;
        logger.warn(module, `Attempt ${attempt} failed:`, { error: error.message });

        if (attempt < maxAttempts) {
          const delay = Math.min(
            baseDelay * Math.pow(backoffMultiplier, attempt - 1),
            maxDelay
          );
          logger.debug(module, `Retrying in ${delay}ms...`);
          if (onRetry) onRetry(attempt, delay);
          await this._sleep(delay);
        }
      }
    }

    logger.error(module, `All ${maxAttempts} attempts failed`, lastError);
    throw lastError;
  }

  /**
   * Gestisci errore con fallback
   */
  async handleWithFallback(primaryFn, fallbackFn, options = {}) {
    const { module = 'Unknown' } = options;

    try {
      return await primaryFn();
    } catch (error) {
      logger.warn(module, 'Primary function failed, trying fallback', { error: error.message });
      try {
        return await fallbackFn();
      } catch (fallbackError) {
        logger.error(module, 'Fallback also failed', fallbackError);
        throw fallbackError;
      }
    }
  }

  /**
   * Classifica errore e applica strategia
   */
  classifyError(error) {
    if (error.message.includes('Network') || error.message.includes('timeout')) {
      return 'NETWORK_ERROR';
    }
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      return 'AUTH_ERROR';
    }
    if (error.message.includes('429') || error.message.includes('rate')) {
      return 'RATE_LIMIT_ERROR';
    }
    if (error.message.includes('500') || error.message.includes('server')) {
      return 'SERVER_ERROR';
    }
    return 'UNKNOWN_ERROR';
  }

  /**
   * Gestisci errore classificato
   */
  async handleClassifiedError(error, context = {}) {
    const errorType = this.classifyError(error);
    logger.error(context.module || 'ErrorHandler', `Error classified as ${errorType}`, error);

    // Applica strategia personalizzata se esiste
    if (this.errorStrategies[errorType]) {
      return await this.errorStrategies[errorType](error, context);
    }

    // Chiama handler globali
    for (const handler of this.globalErrorHandlers) {
      await handler(error, errorType, context);
    }

    throw error;
  }

  /**
   * Timeout wrapper
   */
  async withTimeout(fn, timeoutMs, module = 'Unknown') {
    return Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Timeout after ${timeoutMs}ms`)),
          timeoutMs
        )
      ),
    ]).catch(error => {
      logger.error(module, 'Timeout or error', error);
      throw error;
    });
  }

  /**
   * Circuit breaker pattern
   */
  createCircuitBreaker(fn, options = {}) {
    const {
      failureThreshold = 5,
      resetTimeout = 60000,
      module = 'CircuitBreaker',
    } = options;

    let failureCount = 0;
    let state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    let nextAttemptTime = Date.now();

    return async (...args) => {
      if (state === 'OPEN') {
        if (Date.now() < nextAttemptTime) {
          throw new Error('Circuit breaker is OPEN');
        }
        state = 'HALF_OPEN';
        logger.info(module, 'Circuit breaker transitioning to HALF_OPEN');
      }

      try {
        const result = await fn(...args);
        if (state === 'HALF_OPEN') {
          state = 'CLOSED';
          failureCount = 0;
          logger.info(module, 'Circuit breaker reset to CLOSED');
        }
        return result;
      } catch (error) {
        failureCount++;
        logger.warn(module, `Failure ${failureCount}/${failureThreshold}`);

        if (failureCount >= failureThreshold) {
          state = 'OPEN';
          nextAttemptTime = Date.now() + resetTimeout;
          logger.error(module, `Circuit breaker OPEN (will reset in ${resetTimeout}ms)`);
        }
        throw error;
      }
    };
  }

  /**
   * Sleep utility
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const errorHandler = new ErrorHandler();
export default ErrorHandler;
