import type { IncomingMessage, ServerResponse } from "node:http";
import type { Express } from "express";

type VercelRequest = IncomingMessage & { method?: string; url?: string };
type VercelResponse = ServerResponse & {
  status?: (code: number) => VercelResponse;
  json?: (body: unknown) => void;
};

let appPromise: Promise<Express> | undefined;

async function getApp() {
  appPromise ??= import("../server/app").then(({ createApp }) => createApp());
  return appPromise!;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const pathname = (req.url ?? "").split("?", 1)[0];
  if (pathname === "/api/health") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  try {
    const app = await getApp();
    return (app as unknown as (request: VercelRequest, response: VercelResponse) => unknown)(req, res);
  } catch (error) {
    console.error("[Vercel] API initialization failed", error instanceof Error ? error.message : "unknown error");
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "server initialization failed" }));
  }
}
