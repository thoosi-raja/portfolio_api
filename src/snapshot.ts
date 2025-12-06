import { prisma } from "./prisma";
import { fetchGoldInrPerGram, fetchMutualFundNav, fetchStockQuote } from "./pricing";
import { type Holding, type HoldingType, type Portfolio } from "@prisma/client";

type DbHolding = Holding;

export type EnrichedHolding = DbHolding & {
  latestPriceInInr: number;
  latestValueInInr: number;
  priceSource: string;
  asOf: string;
  changePercent?: number | undefined;
};

export type PortfolioSnapshot = {
  portfolio: Portfolio;
  holdings: EnrichedHolding[];
  totals: {
    valueInInr: number;
    byType: Record<HoldingType | string, number>;
  };
};

async function enrichHolding(holding: DbHolding): Promise<EnrichedHolding> {
  if (holding.type === "stock" && holding.symbol) {
    const quote = await fetchStockQuote(holding.symbol);
    const latestPriceInInr = quote.price;
    return {
      ...holding,
      latestPriceInInr,
      latestValueInInr: latestPriceInInr * (holding.quantity ?? 0),
      priceSource: quote.identifier,
      asOf: quote.asOf,
      changePercent: quote.changePercent,
    };
  }

  if (holding.type === "mutual_fund" && holding.schemeCode) {
    const nav = await fetchMutualFundNav(holding.schemeCode);
    return {
      ...holding,
      latestPriceInInr: nav.price,
      latestValueInInr: nav.price * (holding.units ?? 0),
      priceSource: nav.identifier,
      asOf: nav.asOf,
    };
  }

  if (holding.type === "gold") {
    const gold = await fetchGoldInrPerGram();
    return {
      ...holding,
      latestPriceInInr: gold.price,
      latestValueInInr: gold.price * (holding.grams ?? 0),
      priceSource: gold.identifier,
      asOf: gold.asOf,
    };
  }

  if (holding.type === "loan") {
    const value = -Math.abs(holding.outstandingInInr ?? 0);
    return {
      ...holding,
      latestPriceInInr: value,
      latestValueInInr: value,
      priceSource: "manual",
      asOf: new Date().toISOString(),
    };
  }

  const manualValue = holding.currentValueInInr ?? 0;
  return {
    ...holding,
    latestPriceInInr: manualValue,
    latestValueInInr: manualValue,
    priceSource: "manual",
    asOf: new Date().toISOString(),
  };
}

export async function getPortfolioSnapshotForUser(
  portfolioId: string,
  userId: string,
): Promise<PortfolioSnapshot> {
  const portfolio = await prisma.portfolio.findFirst({
    where: { id: portfolioId, userId },
  });
  if (!portfolio) {
    throw new Error("Portfolio not found");
  }

  const holdings = await prisma.holding.findMany({
    where: { portfolioId },
    orderBy: { createdAt: "asc" },
  });

  const enriched = await Promise.all(holdings.map(enrichHolding));

  const totals = enriched.reduce<PortfolioSnapshot["totals"]>(
    (acc, item) => {
      acc.valueInInr += item.latestValueInInr;
      acc.byType[item.type] = (acc.byType[item.type] ?? 0) + item.latestValueInInr;
      return acc;
    },
    { valueInInr: 0, byType: {} },
  );

  return { portfolio, holdings: enriched, totals };
}
