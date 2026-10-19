import { randomUUID } from 'node:crypto';
import type { ErrorRequestHandler } from 'express';
import { DependencyUnavailableError } from '../../application/errors/dependency-unavailable.error.js';

export type ApiErrorCode = 'DEPENDENCY_UNAVAILABLE' | 'INTERNAL_ERROR';

export interface ApiErrorContext {
  readonly requestId: string;
  readonly statusCode: number;
  readonly errorCode: ApiErrorCode;
}

export type ApiErrorReporter = (error: unknown, context: ApiErrorContext) => void;

export function createApiErrorHandler(onError: ApiErrorReporter): ErrorRequestHandler {
  return (error: unknown, _req, res, next) => {
    // If a response has already started, Express must
    // handle the error without sending another response.
    if (res.headersSent) {
      next(error);
      return;
    }
    const unavailable = error instanceof DependencyUnavailableError;

    const statusCode = unavailable ? 503 : 500;

    const errorCode: ApiErrorCode = unavailable ? 'DEPENDENCY_UNAVAILABLE' : 'INTERNAL_ERROR';

    const message = unavailable ? 'Service temporarily unavailable' : 'Request processing failed';

    const existingRequestId: unknown = res.locals['requestId'];
    const requestId = typeof existingRequestId === 'string' ? existingRequestId : randomUUID();

    res.setHeader('X-Request-Id', requestId);

    onError(error, {
      requestId,
      statusCode,
      errorCode,
    });

    res.status(statusCode).json({
      error: {
        code: errorCode,
        message,
        requestId,
      },
    });
  };
}
