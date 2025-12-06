import yahooFinance from "yahoo-finance2";
import { ENV } from "./env";

type CachedEntry<T> = { expires: number; value: T };
const memoryCache = new Map<string, CachedEntry<unknown>>();

const FIVE_MINUTES = 1000 * 60 * 5;
const TEN_MINUTES = 1000 * 60 * 10;
const ONE_HOUR = 1000 * 60 * 60;

async function cacheWithTtl<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const cached = memoryCache.get(key) as CachedEntry<T> | undefined;
  if (cached && cached.expires > now) {
    return cached.value;
  }
  const value = await loader();
  memoryCache.set(key, { value, expires: now + ttlMs });
  return value;
}

async function fetchJson(url: string, headers?: Record<string, string>): Promise<any> {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Request failed ${res.status} for ${url}`);
  }
  return res.json();
}

export type PriceQuote = {
  identifier: string;
  price: number;
  currency: string;
  asOf: string;
  changePercent?: number | undefined;
};

// Stocks: Yahoo Finance (INR pricing for NSE/BSE with .NS suffix)
export const fetchStockQuote = (symbol: string) => {
  return cacheWithTtl<PriceQuote>(`stock:${symbol}`, FIVE_MINUTES, async () => {
    const quote = await yahooFinance.quote(symbol, {
      fields: ["regularMarketPrice", "regularMarketChangePercent", "regularMarketTime", "currency"],
    });
    if (!quote?.regularMarketPrice) {
      throw new Error(`No quote for ${symbol}`);
    }
    return {
      identifier: symbol,
      price: Number(quote.regularMarketPrice),
      currency: quote.currency ?? "INR",
      asOf: new Date(quote.regularMarketTime ?? Date.now()).toISOString(),
      changePercent:
        quote.regularMarketChangePercent !== undefined
          ? Number(quote.regularMarketChangePercent)
          : undefined,
    };
  });
};

// Mutual funds: AMFI CSV (NAVAll.txt), cached 1 hour, filtered by scheme code
export const fetchMutualFundNav = (schemeCode: string) => {
  return cacheWithTtl<PriceQuote>(`mf:${schemeCode}`, ONE_HOUR, async () => {
    const url = "https://www.amfiindia.com/spages/NAVAll.txt";
    const text = await fetch(url, {
      headers: { "User-Agent": "portfolio-tracker" },
    }).then((r) => {
      if (!r.ok) throw new Error(`AMFI request failed ${r.status}`);
      return r.text();
    });

    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    // Lines are semicolon-separated; scheme code is first column.
    const match = lines.find((line) => line.startsWith(`${schemeCode};`));
    if (!match) {
      throw new Error(`No NAV for scheme ${schemeCode}`);
    }
    const parts = match.split(";");
    const navString = parts[4];
    const dateString = parts[5];
    const price = Number(navString);
    if (Number.isNaN(price)) {
      throw new Error(`Invalid NAV for scheme ${schemeCode}`);
    }
    return {
      identifier: schemeCode,
      price,
      currency: "INR",
      asOf: new Date(dateString).toISOString(),
    };
  });
};

// Gold: India Gold Rates API (requires GOLD_API_KEY), fallback to env fallback
export const fetchGoldInrPerGram = () => {
  return cacheWithTtl<PriceQuote>("gold:igr", FIVE_MINUTES, async () => {
    const FALLBACK_INR_PER_GRAM = ENV.GOLD_FALLBACK_INR_PER_GRAM;
    const apiKey = ENV.GOLD_API_KEY;
    const url = ENV.GOLD_API_URL;

    if (!apiKey) {
      return {
        identifier: "india-gold-fallback",
        price: FALLBACK_INR_PER_GRAM,
        currency: "INR",
        asOf: new Date().toISOString(),
      };
    }

    try {
      const data = await fetchJson(url, { "x-api-key": apiKey });
      // Attempt common field names; adjust as needed per provider response.
      const price =
        Number(
          data?.pricePerGram ??
            data?.price ??
            data?.data?.pricePerGram ??
            data?.data?.price,
        ) || FALLBACK_INR_PER_GRAM;
      return {
        identifier: "india-gold-rates-api",
        price,
        currency: "INR",
        asOf: new Date().toISOString(),
      };
    } catch {
      return {
        identifier: "india-gold-fallback",
        price: FALLBACK_INR_PER_GRAM,
        currency: "INR",
        asOf: new Date().toISOString(),
      };
    }
  });
};
