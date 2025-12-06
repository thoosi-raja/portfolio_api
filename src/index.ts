import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import portfolioRoutes from "./routes/portfolios";
import holdingRoutes from "./routes/holdings";
import { ENV } from "./env";

const app = express();

app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/auth", authRoutes);
app.use("/", portfolioRoutes);
app.use("/", holdingRoutes);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: unknown) => {
  console.error("Unhandled error", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(ENV.PORT, () => {
  console.log(`API listening on port ${ENV.PORT}`);
});
