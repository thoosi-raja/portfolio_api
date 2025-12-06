import { type Request, type Response, type NextFunction } from "express";
import { verifyAuthToken, type AuthTokenPayload } from "../auth";

export type AuthedRequest = Request & { user?: AuthTokenPayload };

export function authRequired(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const [, token] = header.split(" ");
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const payload = verifyAuthToken(token);
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}
