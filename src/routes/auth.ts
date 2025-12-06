import { Router } from "express";
import { z } from "zod";
import { findUserByEmail, hashPassword, signAuthToken, verifyPassword } from "../auth";
import { prisma } from "../prisma";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const { email, password, name } = parsed.data;
  const existing = await findUserByEmail(email);
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, name, passwordHash },
  });

  const token = signAuthToken({ sub: user.id, email: user.email, plan: user.plan });
  return res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const { email, password } = parsed.data;
  const user = await findUserByEmail(email);
  if (!user?.passwordHash) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = signAuthToken({ sub: user.id, email: user.email, plan: user.plan });
  return res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

export default router;
