import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { authRequired, type AuthedRequest } from "../middleware/authRequired";
import { getLimits } from "../limits";
import { getPortfolioSnapshotForUser } from "../snapshot";

const router = Router();

const createSchema = z.object({
  name: z.string().min(1).max(120),
  baseCurrency: z.string().default("INR"),
});

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  baseCurrency: z.string().optional(),
});

router.get("/", authRequired, async (req: AuthedRequest, res) => {
  const userId = req.user!.sub;
  const portfolios = await prisma.portfolio.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { holdings: true } } },
  });
  return res.json({ portfolios });
});

router.post("/", authRequired, async (req: AuthedRequest, res) => {
  const userId = req.user!.sub;
  const plan = req.user!.plan ?? "FREE";
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const limits = getLimits(plan);
  const count = await prisma.portfolio.count({ where: { userId } });
  if (count >= limits.portfolios) {
    return res.status(403).json({ error: "Portfolio limit reached for current plan" });
  }

  const portfolio = await prisma.portfolio.create({
    data: { ...parsed.data, userId },
  });
  return res.status(201).json({ portfolio });
});

router.get("/:id", authRequired, async (req: AuthedRequest, res) => {
  const userId = req.user!.sub;
  const portfolioId = req.params.id;
  if (!portfolioId) {
    return res.status(400).json({ error: "Missing portfolio id" });
  }
  const portfolio = await prisma.portfolio.findFirst({
    where: { id: portfolioId, userId },
    include: { holdings: true },
  });
  if (!portfolio) {
    return res.status(404).json({ error: "Not found" });
  }
  return res.json({ portfolio });
});

router.patch("/:id", authRequired, async (req: AuthedRequest, res) => {
  const userId = req.user!.sub;
  const portfolioId = req.params.id;
  if (!portfolioId) {
    return res.status(400).json({ error: "Missing portfolio id" });
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const portfolio = await prisma.portfolio.findFirst({
    where: { id: portfolioId, userId },
  });
  if (!portfolio) {
    return res.status(404).json({ error: "Not found" });
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.baseCurrency !== undefined)
    updateData.baseCurrency = parsed.data.baseCurrency;

  const updated = await prisma.portfolio.update({
    where: { id: portfolioId },
    data: updateData,
  });
  return res.json({ portfolio: updated });
});

router.delete("/:id", authRequired, async (req: AuthedRequest, res) => {
  const userId = req.user!.sub;
  const portfolioId = req.params.id;
  if (!portfolioId) {
    return res.status(400).json({ error: "Missing portfolio id" });
  }
  const portfolio = await prisma.portfolio.findFirst({
    where: { id: portfolioId, userId },
  });
  if (!portfolio) {
    return res.status(404).json({ error: "Not found" });
  }
  await prisma.portfolio.delete({ where: { id: portfolioId } });
  return res.json({ success: true });
});

router.get("/:id/snapshot", authRequired, async (req: AuthedRequest, res) => {
  const portfolioId = req.params.id;
  if (!portfolioId) {
    return res.status(400).json({ error: "Missing portfolio id" });
  }
  try {
    const snapshot = await getPortfolioSnapshotForUser(portfolioId, req.user!.sub);
    return res.json(snapshot);
  } catch (error) {
    console.error("Failed to build snapshot", error);
    return res
      .status(500)
      .json({ error: "Unable to fetch live data. Check API keys and limits." });
  }
});

export default router;
