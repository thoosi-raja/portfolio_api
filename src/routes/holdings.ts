import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";
import { authRequired, type AuthedRequest } from "../middleware/authRequired";
import { getLimits } from "../limits";

const router = Router();

const holdingInputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("stock"),
    name: z.string().min(1),
    symbol: z.string().min(1),
    quantity: z.number().positive(),
    costPerUnit: z.number().positive().optional(),
    note: z.string().optional(),
  }),
  z.object({
    type: z.literal("mutual_fund"),
    name: z.string().min(1),
    schemeCode: z.string().min(1),
    units: z.number().positive(),
    costPerUnit: z.number().positive().optional(),
    note: z.string().optional(),
  }),
  z.object({
    type: z.literal("gold"),
    name: z.string().min(1),
    grams: z.number().positive(),
    costPerGram: z.number().positive().optional(),
    note: z.string().optional(),
  }),
  z.object({
    type: z.literal("land"),
    name: z.string().min(1),
    currentValueInInr: z.number().positive(),
    note: z.string().optional(),
  }),
  z.object({
    type: z.literal("loan"),
    name: z.string().min(1),
    outstandingInInr: z.number().positive(),
    rateAprPercent: z.number().positive(),
    note: z.string().optional(),
  }),
]);

const holdingUpdateSchema = z.object({
  name: z.string().optional(),
  symbol: z.string().optional(),
  schemeCode: z.string().optional(),
  quantity: z.number().positive().optional(),
  units: z.number().positive().optional(),
  grams: z.number().positive().optional(),
  currentValueInInr: z.number().nonnegative().optional(),
  outstandingInInr: z.number().positive().optional(),
  rateAprPercent: z.number().positive().optional(),
  costPerUnit: z.number().positive().optional(),
  costPerGram: z.number().positive().optional(),
  note: z.string().optional(),
});

router.post(
  "/portfolios/:id/holdings",
  authRequired,
  async (req: AuthedRequest, res) => {
    const userId = req.user!.sub;
    const portfolioId = req.params.id;
    if (!portfolioId) {
      return res.status(400).json({ error: "Missing portfolio id" });
    }
    const portfolio = await prisma.portfolio.findFirst({
      where: { id: portfolioId, userId },
    });
    if (!portfolio) {
      return res.status(404).json({ error: "Portfolio not found" });
    }

    const parsed = holdingInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const limits = getLimits(req.user!.plan ?? "FREE");
    const count = await prisma.holding.count({ where: { portfolioId } });
    if (count >= limits.holdings) {
      return res
        .status(403)
        .json({ error: "Holding limit reached for current plan" });
    }

    const payload = parsed.data;
    let createData: Prisma.HoldingUncheckedCreateInput = {
      portfolioId,
      type: payload.type,
      name: payload.name,
      note: payload.note ?? null,
      symbol: null,
      schemeCode: null,
      quantity: null,
      units: null,
      grams: null,
      currentValueInInr: null,
      outstandingInInr: null,
      rateAprPercent: null,
      costPerUnit: null,
      costPerGram: null,
    };

    if (payload.type === "stock") {
      createData = {
        ...createData,
        symbol: payload.symbol,
        quantity: payload.quantity,
        costPerUnit: payload.costPerUnit ?? null,
      };
    } else if (payload.type === "mutual_fund") {
      createData = {
        ...createData,
        schemeCode: payload.schemeCode,
        units: payload.units,
        costPerUnit: payload.costPerUnit ?? null,
      };
    } else if (payload.type === "gold") {
      createData = {
        ...createData,
        grams: payload.grams,
        costPerGram: payload.costPerGram ?? null,
      };
    } else if (payload.type === "land") {
      createData = {
        ...createData,
        currentValueInInr: payload.currentValueInInr,
      };
    } else if (payload.type === "loan") {
      createData = {
        ...createData,
        outstandingInInr: payload.outstandingInInr,
        rateAprPercent: payload.rateAprPercent,
      };
    }

    const created = await prisma.holding.create({
      data: createData,
    });

    return res.status(201).json({ holding: created });
  },
);

router.patch("/holdings/:id", authRequired, async (req: AuthedRequest, res) => {
  const holdingId = req.params.id;
  if (!holdingId) {
    return res.status(400).json({ error: "Missing holding id" });
  }
  const parsed = holdingUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const holding = await prisma.holding.findFirst({
    where: { id: holdingId, portfolio: { userId: req.user!.sub } },
  });
  if (!holding) {
    return res.status(404).json({ error: "Not found" });
  }

  const updateData: Record<string, unknown> = {};
  const payload = parsed.data;
  if (payload.name !== undefined) updateData.name = payload.name;
  if (payload.symbol !== undefined) updateData.symbol = payload.symbol;
  if (payload.schemeCode !== undefined) updateData.schemeCode = payload.schemeCode;
  if (payload.quantity !== undefined) updateData.quantity = payload.quantity;
  if (payload.units !== undefined) updateData.units = payload.units;
  if (payload.grams !== undefined) updateData.grams = payload.grams;
  if (payload.currentValueInInr !== undefined)
    updateData.currentValueInInr = payload.currentValueInInr;
  if (payload.outstandingInInr !== undefined)
    updateData.outstandingInInr = payload.outstandingInInr;
  if (payload.rateAprPercent !== undefined)
    updateData.rateAprPercent = payload.rateAprPercent;
  if (payload.costPerUnit !== undefined) updateData.costPerUnit = payload.costPerUnit;
  if (payload.costPerGram !== undefined) updateData.costPerGram = payload.costPerGram;
  if (payload.note !== undefined) updateData.note = payload.note;

  const updated = await prisma.holding.update({
    where: { id: holdingId },
    data: updateData,
  });

  return res.json({ holding: updated });
});

router.delete("/holdings/:id", authRequired, async (req: AuthedRequest, res) => {
  const holdingId = req.params.id;
  if (!holdingId) {
    return res.status(400).json({ error: "Missing holding id" });
  }
  const holding = await prisma.holding.findFirst({
    where: { id: holdingId, portfolio: { userId: req.user!.sub } },
  });
  if (!holding) {
    return res.status(404).json({ error: "Not found" });
  }

  await prisma.holding.delete({ where: { id: holdingId } });
  return res.json({ success: true });
});

export default router;
