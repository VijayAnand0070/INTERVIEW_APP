import { verifyAuthToken } from "../lib/verifyAuthToken.js";
import { ApiError } from "../utils/errors.js";

export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";

    const { user, error } = await verifyAuthToken(token);
    if (!user) {
      throw new ApiError(401, error || "Invalid or expired session");
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

