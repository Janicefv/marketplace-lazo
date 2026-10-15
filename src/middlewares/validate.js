// Valida body, query y params con Zod; el resultado limpio queda en req.validated.
import { BadRequestError } from '../utils/errors.js';

export const validate = (schemas) => (req, _res, next) => {
  const validated = {};
  for (const [part, schema] of Object.entries(schemas)) {
    const result = schema.safeParse(req[part] ?? {});
    if (!result.success) {
      throw BadRequestError(
        'VALIDATION_ERROR',
        'Revisa los datos enviados.',
        result.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
      );
    }
    validated[part] = result.data;
  }
  req.validated = validated;
  next();
};
