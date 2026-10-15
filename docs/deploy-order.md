# Safe Zero-Downtime Deployment Order

This procedure ensures that the proxy is upgraded and verified with backward compatibility before locking down traffic with the shared secret.

---

## 1. Prerequisites & Status

- **Proxy repo:** `gymos-proxy` (branch `feat/proxy-phase-d`)
- **App repo:** `gymos` (branch `feat/nourish-ai-estimates`)
- **Render Service:** Points to GitHub repo `gymos-proxy`.
- **Target Contract:** Contract Version 2 (`/health` returns `contractVersion: 2`).

---

## 2. Step-by-Step Deployment Order

### Step A: Deploy the Proxy with NO Shared Secret
1. Merge branch `feat/proxy-phase-d` into `main` in `gymos-proxy` (or point Render to `feat/proxy-phase-d`).
2. In Render Dashboard -> Environment Settings:
   - Ensure `GEMINI_API_KEY` is set.
   - Set `GROUNDING_ENABLED=true` (or leave default false if running without search grounding).
   - **DO NOT** set `GYMOS_SHARED_SECRET` yet (leave it blank or undefined).
3. Trigger Render deploy (`Manual Deploy` -> `Deploy latest commit`).
4. Wait for Render build to finish and service status to show "Live".

### Step B: Check `/health` Endpoint
1. Execute from your workstation or terminal:
   ```bash
   curl -i https://<your-render-proxy-url>/health
   ```
2. Verify:
   - HTTP status code is `200 OK`.
   - Response body is:
     ```json
     {"status":"ok","contractVersion":2,"uptime":<number>}
     ```
   - Check `HEAD /status` also returns `200 OK`.
3. Note: Because no secret is set yet, older app versions (and current builds) continue to function without interruption.

### Step C: Run Live Evaluation Against Deployed Proxy
Run the 25-food evaluation script against the deployed service:
```bash
PROXY_URL=https://<your-render-proxy-url> GEMINI_API_KEY=<your-key> npm run eval:new
```
1. Verify that the 25 evaluation items pass category, portion, macro, and zero-calorie rules.
2. If comparing with the legacy prompt:
   ```bash
   npm run eval:compare
   ```
   (Pacing and 429 backoff are enabled automatically to prevent free-tier rate-limit false failures).

### Step D: Add the Shared Secret to the App and Verify It
1. Generate a strong random shared secret:
   ```bash
   openssl rand -hex 24
   ```
2. Set the secret in the app environment (`.env` or EAS secrets):
   ```env
   EXPO_PUBLIC_GYMOS_SHARED_SECRET=<your-random-secret>
   ```
3. Test locally in the mobile app:
   - Open Nourish tab.
   - Enter a food not in local catalog (e.g. `"sattu paratha"`).
   - The app sends `x-gymos-secret: <your-random-secret>`.
   - Because the proxy does not have `GYMOS_SHARED_SECRET` set yet, it ignores unknown headers and responds with `200 OK`.
   - Verify that meal resolution succeeds.

### Step E: Set the Same Shared Secret on the Proxy
1. In Render Dashboard -> Environment Settings:
   - Add `GYMOS_SHARED_SECRET=<your-random-secret>`.
2. Save changes (Render will trigger an automatic zero-downtime rolling restart).
3. Test verification:
   - **Without secret (unauthorized):**
     ```bash
     curl -i -X POST https://<your-render-proxy-url>/estimate \
       -H "Content-Type: application/json" \
       -d '{"description":"1 bowl daliya"}'
     ```
     Must return `401 Unauthorized` (`{"error":"Unauthorized"}`).
   - **With secret (authorized):**
     ```bash
     curl -i -X POST https://<your-render-proxy-url>/estimate \
       -H "Content-Type: application/json" \
       -H "x-gymos-secret: <your-random-secret>" \
       -d '{"description":"1 bowl daliya"}'
     ```
     Must return `200 OK` with full nutritional JSON.
   - **Health endpoint:**
     ```bash
     curl -i https://<your-render-proxy-url>/health
     ```
     Must return `200 OK` without any secret header required.

---

## 3. Rollback Procedure

If any step fails or upstream anomalies occur:

### Rollback Proxy Secret
1. If clients are receiving 401 errors, remove `GYMOS_SHARED_SECRET` from Render environment variables and save.
2. The proxy immediately permits requests without secret header.

### Rollback Proxy Code
1. In Render Dashboard, click **Deploys**.
2. Find the previous successful deployment commit (`f07c424` or previous release).
3. Click **Rollback to this deploy**.
4. Confirm `/health` responds with contract version 1 or 200 OK.
5. Client tolerance: GymOS app tolerates legacy contract version 1 seamlessly (falls back to default confidence 0.7 and infers assumption).
