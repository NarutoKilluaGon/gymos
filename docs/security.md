# Security & Threat Model: GymOS Proxy & Client Contract

## 1. Shared Secret (`x-gymos-secret`) & Client Bundle Reality

### Public Environment Variables in React Native / Expo
The mobile app transmits an authentication header `x-gymos-secret` when calling `POST /estimate`.
In the Expo client configuration:
- The secret is provided via `EXPO_PUBLIC_GYMOS_SHARED_SECRET`.
- **CRITICAL NOTE:** Any variable prefixed with `EXPO_PUBLIC_` is inlined at build time into the client JavaScript bundle.
- Anyone who extracts the APK / IPA or inspects network traffic (via proxy tools like Charles, Proxyman, or mitmproxy) can easily read this string.

### Purpose: Application-Level Deterrent, Not Identity Proof
- **What it does protect against:**
  - Casual automated internet crawlers and bots scanning open HTTP endpoints.
  - Generic search-engine scraping and casual drive-by traffic on Render's public URL.
- **What it does NOT protect against:**
  - A determined user or reverse-engineer who extracts the secret from the compiled mobile binary.
  - Dedicated attackers replaying requests with the extracted secret.

### Constant-Time Verification on Proxy
To eliminate timing side-channel attacks (where an attacker measures microscopic response latency variations to guess character by character):
- The proxy computes buffers for both candidate and expected secrets.
- If lengths differ, it compares the candidate against itself to consume constant time before returning `false`.
- If lengths match, it executes `crypto.timingSafeEqual(candidateBuffer, secretBuffer)`.

```javascript
function constantTimeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) {
    crypto.timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}
```

---

## 2. Reverse Proxy Client IP Resolution behind Render

### Cloudflare Edge Infrastructure
Render web services run behind Cloudflare reverse proxies. When requests arrive at the Node.js HTTP server:
- `req.socket.remoteAddress` is the internal Render container network bridge or Cloudflare gateway, **never** the end user's device.
- Standard headers set directly and securely by Cloudflare edge:
  1. `cf-connecting-ip`: Injected directly by Cloudflare edge from the client TCP connection. It **cannot** be spoofed by client request headers because Cloudflare overwrites any client-supplied value at the edge.
  2. `true-client-ip`: Injected by Cloudflare Enterprise / edge layers.
  3. `x-forwarded-for`: A comma-separated list `client, proxy1, proxy2`. The leftmost entry is the client, but could be pre-pended by an attacker if an intermediary does not strip it.
- **GymOS proxy precedence:**
  ```javascript
  const clientIp =
    req.headers["cf-connecting-ip"]?.trim() ||
    req.headers["true-client-ip"]?.trim() ||
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  ```

---

## 3. In-Memory State & Volatility Notice

The proxy maintains several operational safeguards in Node.js memory:
1. **Rate Limiter:** `RATE_LIMIT_WINDOW_MS = 60_000` (60 requests/minute per IP).
2. **Daily Grounding Counter:** `MAX_GROUNDED_SEARCHES_PER_DAY = 100` searches per calendar day.
3. **In-Memory Cache:** `CACHE_TTL_MS = 24 * 60 * 60 * 1000` (24-hour TTL keyed by normalized name + unit).

### Volatility Caveats
- **Restarts & Redeployments:** Every Render redeploy, crash, manual restart, or cold container spin-down completely resets these in-memory data structures.
- **Multi-Instance Scaling:** If the Render service is ever scaled horizontally to 2 or more instances, each instance maintains its own separate memory map.
- **Production Recommendation:** If persistent quotas and distributed rate limiting are required, migrate the IP bucket and grounding counter to Redis (Upstash) with atomics.

---

## 4. Upstream Gemini API Key Privacy

- `GEMINI_API_KEY` is loaded exclusively from server environment variables on Render.
- Transmitted upstream strictly via the `x-goog-api-key` HTTP header.
- The URL query string does not carry the API key.
- Upstream network errors and timeout aborts sanitize all logs, ensuring keys are never leaked to logs or client error payloads.
