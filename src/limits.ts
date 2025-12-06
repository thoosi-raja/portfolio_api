import { type Plan } from "@prisma/client";

const PLAN_LIMITS: Record<Plan | "FREE", { portfolios: number; holdings: number }> = {
  FREE: { portfolios: 1, holdings: 50 },
  PREMIUM: { portfolios: 10, holdings: 500 },
};

export function getLimits(plan: Plan | "FREE" = "FREE") {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.FREE;
}
