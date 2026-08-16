import type { MiddlewareHandler } from "hono";
import type { IdentityContext } from "../auth/types.js";
import { resolveRequestId } from "../chat/request-id.js";
import type { Counters } from "./counters.js";
import { type Logger, requestLogShape } from "./logger.js";

export type RequestObsEnv = {
  Variables: {
    requestId: string;
    identity?: IdentityContext;
  };
};

export function requestObservability(opts: {
  log: Logger;
  counters: Counters;
}): MiddlewareHandler<RequestObsEnv> {
  return async (c, next) => {
    const requestId = resolveRequestId(c.req.header("x-request-id"));
    c.set("requestId", requestId);
    c.header("x-request-id", requestId);
    const started = Date.now();
    await next();
    const status = c.res.status;
    opts.counters.recordHttp(status);
    const identity = c.get("identity");
    opts.log.info(
      requestLogShape({
        method: c.req.method,
        path: c.req.path,
        status,
        duration_ms: Date.now() - started,
        request_id: requestId,
        principal_id: identity?.principalId ?? "anonymous",
      }),
    );
  };
}
