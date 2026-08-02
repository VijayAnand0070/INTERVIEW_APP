import multer from "multer";
import { ZodError } from "zod";
import { logger } from "../config/logger.js";

function zodDetails(error) {
  return (error.issues || error.errors || []).map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
}

export function errorHandler(error, req, res, _next) {
  const requestId = req?.id || "unknown";

  // Zod validation errors
  if (error instanceof ZodError) {
    res.status(400).json({ message: "Validation failed", details: zodDetails(error), requestId });
    return;
  }

  // Multer errors
  if (error instanceof multer.MulterError) {
    const msg =
      error.code === "LIMIT_FILE_SIZE"
        ? "File is too large"
        : error.message || "File upload error";
    res.status(400).json({ message: msg, requestId });
    return;
  }

  // Custom ApiError
  const statusCode = error.statusCode || 500;
  const message =
    statusCode === 500 ? "Internal server error" : error.message || "Request failed";

  if (statusCode >= 500) {
    logger.error({
      msg: "Server error",
      requestId,
      error: error.message,
      stack: error.stack,
      url: req?.originalUrl,
      method: req?.method,
      userId: req?.user?.id,
    });
  } else if (statusCode >= 400) {
    logger.warn({
      msg: `Client error ${statusCode}`,
      requestId,
      error: error.message,
      url: req?.originalUrl,
    });
  }

  res.status(statusCode).json({
    message,
    details: error.details,
    requestId,
  });
}
