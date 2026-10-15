// Errores de dominio: cada uno sabe su código HTTP y un código estable para el frontend.
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const BadRequestError = (code, message, details) => new AppError(400, code, message, details);
export const UnauthorizedError = (code, message) => new AppError(401, code, message);
export const ForbiddenError = (code, message) => new AppError(403, code, message);
export const NotFoundError = (code, message) => new AppError(404, code, message);
export const ConflictError = (code, message) => new AppError(409, code, message);
export const UnprocessableError = (code, message, details) => new AppError(422, code, message, details);
export const ServiceUnavailableError = (code, message) => new AppError(503, code, message);
