import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";
import type { User } from "@workspace/db";

const JWT_SECRET = process.env.JWT_SECRET ?? (process.env.NODE_ENV !== "production" ? "flash-net-dev-secret-change-in-production" : undefined);
const JWT_EXPIRES_IN = "7d";

function getSecret(): string {
  if (!JWT_SECRET) {
    throw new Error(
      "JWT_SECRET environment variable must be set in production. " +
      "Set it as a Replit Secret named JWT_SECRET."
    );
  }
  return JWT_SECRET;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface JwtPayload {
  userId: number;
  role: string;
}

export function createToken(userId: number, role: string): string {
  return jwt.sign({ userId, role } satisfies JwtPayload, getSecret(), {
    expiresIn: JWT_EXPIRES_IN,
    issuer: "flash-net",
    audience: "flash-net-app",
  });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const payload = jwt.verify(token, getSecret(), {
      issuer: "flash-net",
      audience: "flash-net-app",
    }) as JwtPayload;
    return payload;
  } catch {
    return null;
  }
}

declare global {
  namespace Express {
    interface Request {
      currentUser?: User;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthorized", message: "No token provided" });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "unauthorized", message: "Invalid or expired token" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, payload.userId))
    .limit(1);

  if (!user || !user.isActive) {
    res.status(401).json({ error: "unauthorized", message: "User not found or inactive" });
    return;
  }

  req.currentUser = user;
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.currentUser;
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ error: "forbidden", message: "Insufficient permissions" });
      return;
    }
    next();
  };
}
