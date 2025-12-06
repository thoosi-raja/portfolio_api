import dotenv from "dotenv";

dotenv.config();

function getEnv(name: string, required = true): string {
  const value = process.env[name];
  if (!value && required) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value ?? "";
}

export const ENV = {
  DATABASE_URL: getEnv("DATABASE_URL"),
  JWT_SECRET: getEnv("JWT_SECRET"),
  GOLD_FALLBACK_INR_PER_GRAM: Number(
    process.env.GOLD_FALLBACK_INR_PER_GRAM ?? "12020",
  ),
  PORT: Number(process.env.PORT ?? 4000),
  GOLD_API_KEY: getEnv("GOLD_API_KEY", false),
  GOLD_API_URL:
    process.env.GOLD_API_URL ??
    "https://www.indiagoldratesapi.com/api/IndiaGoldRate?city=mumbai",
};
