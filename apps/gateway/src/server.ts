import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";

const env = loadEnv();
const app = createApp();

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  process.stdout.write(
    `${JSON.stringify({
      msg: "gateway_listening",
      port: info.port,
      node_env: env.NODE_ENV,
    })}\n`,
  );
});
