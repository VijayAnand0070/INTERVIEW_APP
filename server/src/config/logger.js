import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:HH:MM:ss.l",
            ignore: "pid,hostname",
            singleLine: false,
          },
        },
      }
    : {}),
  serializers: {
    err: pino.stdSerializers.err,
    req: (req) => ({
      method: req.method,
      url: req.url,
      requestId: req.id,
      userId: req.user?.id,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
  base: { service: "interview_agent-api" },
});

/**
 * Express middleware that attaches a request ID, child logger, and logs
 * request start/end with latency.
 */
export function requestLogger(req, res, next) {
  const requestId =
    req.headers["x-request-id"] || crypto.randomUUID();

  req.id = requestId;
  req.log = logger.child({ requestId });

  res.setHeader("x-request-id", requestId);

  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

    req.log[level]({
      msg: `${req.method} ${req.originalUrl} ${res.statusCode}`,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      userId: req.user?.id,
    });
  });

  next();
}

/**
 * Logs an AI service call with latency.
 */
export function logAiCall(method, durationMs, error = null) {
  const entry = { msg: `AI:${method}`, method, durationMs: Math.round(durationMs * 100) / 100 };
  if (error) {
    logger.warn({ ...entry, error: error.message || String(error) });
  } else {
    logger.info(entry);
  }
}
