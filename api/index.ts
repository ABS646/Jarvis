import type { IncomingMessage, ServerResponse } from "node:http";
import type { Express } from "express";
import { createApp } from "../server/app";

type VercelRequest = IncomingMessage & { method?: string; url?: string };
type VercelResponse = ServerResponse & {
  status?: (code: number) => VercelResponse;
  json?: (body: unknown) => void;
};

// A static import lets Vercel trace and bundle the TypeScript server module.
const app = createApp();

export default function handler(req: VercelRequest, res: VercelResponse) {
  return (app as unknown as (request: VercelRequest, response: VercelResponse) => unknown)(req, res);
}
