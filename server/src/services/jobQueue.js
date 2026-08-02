/**
 * In-process async job queue using EventEmitter.
 * Handles background evaluation jobs with retry logic and WebSocket progress notifications.
 * Can be upgraded to BullMQ/Redis for multi-server deployments.
 */
import { EventEmitter } from "node:events";
import { logger } from "../config/logger.js";

/* ------------------------------------------------------------------ */
/*  Job Queue                                                          */
/* ------------------------------------------------------------------ */
class JobQueue extends EventEmitter {
  constructor() {
    super();
    this.processing = new Map(); // jobId -> Promise
    this.results = new Map(); // jobId -> result
    this.maxRetries = 2;
  }

  /**
   * Enqueue a job for background processing.
   * Returns a jobId that can be used to track progress.
   */
  enqueue(jobType, payload, handler) {
    const jobId = `${jobType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    logger.info({ msg: "Job enqueued", jobId, jobType });
    this.emit("job:enqueued", { jobId, jobType, payload });

    const execute = async () => {
      let lastError = null;

      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        try {
          this.emit("job:started", { jobId, jobType, attempt });
          const result = await handler(payload, (progress) => {
            this.emit("job:progress", { jobId, jobType, ...progress });
          });

          this.results.set(jobId, { status: "completed", result });
          this.emit("job:completed", { jobId, jobType, result });

          logger.info({ msg: "Job completed", jobId, jobType });
          return result;
        } catch (error) {
          lastError = error;
          logger.warn({
            msg: `Job attempt ${attempt + 1} failed`,
            jobId,
            jobType,
            error: error.message,
          });

          if (attempt < this.maxRetries) {
            const delay = 1000 * 2 ** attempt;
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      this.results.set(jobId, { status: "failed", error: lastError?.message });
      this.emit("job:failed", { jobId, jobType, error: lastError?.message });
      logger.error({ msg: "Job failed after retries", jobId, jobType, error: lastError?.message });
      throw lastError;
    };

    const promise = execute().finally(() => {
      this.processing.delete(jobId);
    });

    this.processing.set(jobId, promise);
    return jobId;
  }

  /**
   * Wait for a specific job to complete.
   */
  async waitFor(jobId, timeoutMs = 300_000) {
    const promise = this.processing.get(jobId);
    if (!promise) {
      const result = this.results.get(jobId);
      if (result) return result;
      throw new Error(`Job ${jobId} not found`);
    }

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Job ${jobId} timed out`)), timeoutMs)
    );

    return Promise.race([promise, timeout]);
  }

  /**
   * Get job status.
   */
  status(jobId) {
    if (this.processing.has(jobId)) return { status: "processing" };
    const result = this.results.get(jobId);
    if (result) return result;
    return { status: "unknown" };
  }
}

export const jobQueue = new JobQueue();
