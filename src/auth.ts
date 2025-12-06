import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { ENV } from "./env";
import { type Plan } from "@prisma/client";

export type AuthTokenPayload = {
  sub: string;
  email: string;
  plan: Plan | "FREE";
};

export function signAuthToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, ENV.JWT_SECRET, { expiresIn: "7d" });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  return jwt.verify(token, ENV.JWT_SECRET) as AuthTokenPayload;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}
