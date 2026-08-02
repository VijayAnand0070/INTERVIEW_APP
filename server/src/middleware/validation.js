/**
 * Zod validation middleware for Express routes.
 * Validates req.body, req.params, and req.query against Zod schemas.
 */
import { ZodError } from "zod";
import { ApiError } from "../utils/errors.js";

function zodDetails(error) {
  return (error.issues || error.errors || []).map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
}

/**
 * Creates Express middleware that validates the request body against a Zod schema.
 * On failure, throws a 400 ApiError with field-level details.
 */
export function validateBody(schema) {
  return (req, _res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new ApiError(400, "Validation failed", zodDetails(error)));
      } else {
        next(error);
      }
    }
  };
}

/**
 * Creates Express middleware that validates route params against a Zod schema.
 */
export function validateParams(schema) {
  return (req, _res, next) => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new ApiError(400, "Invalid route parameters", zodDetails(error)));
      } else {
        next(error);
      }
    }
  };
}

/**
 * Creates Express middleware that validates query parameters against a Zod schema.
 */
export function validateQuery(schema) {
  return (req, _res, next) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new ApiError(400, "Invalid query parameters", zodDetails(error)));
      } else {
        next(error);
      }
    }
  };
}
