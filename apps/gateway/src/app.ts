import { Hono } from "hono";
import { healthPayload } from "./http/health.js";

export function createApp(): Hono {
  const app = new Hono();

  app.get("/health", (c) => c.json(healthPayload(), 200));

  return app;
}
