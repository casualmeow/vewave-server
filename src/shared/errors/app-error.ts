export const apiErrorCodes = [
  "VALIDATION_ERROR",
  "AUTH_INVALID_CREDENTIALS",
  "AUTH_UNAUTHORIZED",
  "AUTH_REFRESH_EXPIRED",
  "ROOM_NOT_FOUND",
  "ROOM_FORBIDDEN",
  "ROOM_NOT_ACTIVE",
  "UNSUPPORTED_MEDIA_URL",
  "MEDIA_PARSE_FAILED",
  "PLAYBACK_COMMAND_FORBIDDEN",
  "INTERNAL_SERVER_ERROR",
] as const;

export type ApiErrorCode = (typeof apiErrorCodes)[number];

export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(code: ApiErrorCode, message: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const isAppError = (error: unknown): error is AppError =>
  error instanceof AppError;

export const toErrorEnvelope = (error: AppError) => ({
  error: {
    code: error.code,
    message: error.message,
    ...(error.details === undefined ? {} : { details: error.details }),
  },
});
