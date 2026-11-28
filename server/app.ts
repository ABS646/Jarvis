import express, { type Express } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./_core/oauth";
import { publicPlatformScript } from "./_core/publicConfig";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { sdk } from "./_core/sdk";
import { processNextBackgroundJob } from "./worker";
import { serveStatic } from "./_core/static";
import { finishBackgroundJob, getBackgroundJobByIdempotencyKey } from "./db";
import { verifyN8nSignature, type N8nCallbackBody } from "./n8n";

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

  app.post("/api/webhooks/n8n", async (req, res) => {
    try {
      const body = req.body as N8nCallbackBody;
      const serialized = JSON.stringify(body);
      if (!verifyN8nSignature(serialized, req.header("X-JARVIS-Signature"))) {
        res.status(401).json({ error: "invalid webhook signature" });
        return;
      }
      if (!body?.idempotencyKey || !["succeeded", "failed"].includes(body.status)) {
        res.status(400).json({ error: "invalid callback payload" });
        return;
      }
      const job = await getBackgroundJobByIdempotencyKey(body.idempotencyKey);
      if (!job) {
        res.status(404).json({ error: "background job not found" });
        return;
      }
      await finishBackgroundJob(job.id, body.status, body.error, body.result === undefined ? undefined : JSON.stringify(body.result));
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error("[n8n] Callback failed", error instanceof Error ? error.message : "unknown error");
      res.status(500).json({ error: "callback processing failed" });
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
