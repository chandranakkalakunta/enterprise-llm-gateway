export type HealthResponse = {
  status: "ok";
  service: "gateway";
};

export function healthPayload(): HealthResponse {
  return { status: "ok", service: "gateway" };
}
