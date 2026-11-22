import express, { type Express } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./_core/oauth";
import { publicPlatformScript } from "./_core/publicConfig";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { sdk } from "./_core/sdk";
import { processNextBackgroundJob } from "./worker";
import { serveStatic } from "./_core/static";

type AppOptions = {
  serveFrontend?: boolean;
};

export function createApp(options: AppOptions = {}): Express {
  const app = express();

  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ limit: "20mb", extended: true }));

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  app.post("/api/scheduled/worker", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) {
        res.status(403).json({ error: "scheduled worker authentication required" });
        return;
      }
      const result = await processNextBackgroundJob();
      res.status(200).json({ ok: true, taskUid: user.taskUid, ...result });
    } catch (error) {
      console.error("[Worker] Scheduled run failed", error instanceof Error ? error.message : "unknown error");
      res.status(500).json({ error: "scheduled worker failed" });
    }
  });

  app.get("/api/platform/config.js", (_req, res) => {
    res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript());
  });

  registerOAuthRoutes(app);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  if (options.serveFrontend) {
    serveStatic(app);
  }

  return app;
}
