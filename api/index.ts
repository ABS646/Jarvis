import type { IncomingMessage, ServerResponse } from "node:http";
import type { Express } from "express";
import { createApp } from "../dist/app.js";

type VercelRequest = IncomingMessage & { method?: string; url?: string };
type VercelResponse = ServerResponse & {
  status?: (code: number) => VercelResponse;
  json?: (body: unknown) => void;
};

const app = createApp();

export default function handler(req: VercelRequest, res: VercelResponse) {
  return (app as unknown as (request: VercelRequest, response: VercelResponse) => unknown)(req, res);
}
