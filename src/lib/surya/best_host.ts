import axios, { AxiosResponse } from "axios";
const { performance } = require("perf_hooks");

// poor mans anycast
// ping and determine closest host on boot

axios.interceptors.request.use((x) => {
  x.meta = x.meta || {};
  x.meta.requestStartedAt = performance.now();
  return x;
});

axios.interceptors.response.use((x) => {
  x.responseTime = performance.now() - x.config.meta.requestStartedAt;
  return x;
});

const minPing = async (url: string, attempts = 2) => {
  const responses: AxiosResponse[] = [];
  for (let i = 0; i < attempts; i++) {
    responses.push(
      await axios.head(url, {
        timeout: 2000,
      })
    );
  }
  return Math.min(...responses.map((r) => r.responseTime));
};

export const determineClosestHost = async (
  hosts: string[],
  tlsEnabled = true
): Promise<string> => {
  const httpPrefix = tlsEnabled ? `https://` : `http://`;
  const pings = hosts.map((h) => {
    const url = `${httpPrefix}${h}/api/v1/cli`;
    return minPing(url)
      .then((min) => ({ success: true, min, host: h }))
      .catch(() => ({ success: false, min: 9999, host: h }));
  });
  const candidates = await Promise.all(pings);
  return candidates.reduce((current, candidate) => {
    if (!candidate.success) return current;
    return candidate.min < current.min ? candidate : current;
  }, candidates[0]).host;
};
