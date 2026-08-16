export type CounterSnapshot = {
  requests_total: number;
  http_4xx: number;
  http_5xx: number;
  provider_errors: number;
};

export type Counters = {
  recordHttp: (status: number) => void;
  recordProviderError: () => void;
  snapshot: () => CounterSnapshot;
};

export function createCounters(): Counters {
  const state: CounterSnapshot = {
    requests_total: 0,
    http_4xx: 0,
    http_5xx: 0,
    provider_errors: 0,
  };

  return {
    recordHttp(status) {
      state.requests_total += 1;
      if (status >= 400 && status < 500) {
        state.http_4xx += 1;
      } else if (status >= 500) {
        state.http_5xx += 1;
      }
    },
    recordProviderError() {
      state.provider_errors += 1;
    },
    snapshot() {
      return { ...state };
    },
  };
}
