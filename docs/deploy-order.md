# Safe Zero-Downtime Deployment Order

This procedure ensures that the prompt and logic are evaluated locally before any deployment, and that the proxy is upgraded and verified with backward compatibility before locking down traffic with the shared secret.

---

## 1. Prerequisites & Status

- **Proxy repo:** `gymos-proxy` (branch `feat/proxy-phase-d`)
- **App repo:** `gymos` (branch `feat/nourish-ai-estimates`)
- **Render Service:** Points to GitHub repo `gymos-proxy`.
- **Target Contract:** Contract Version 2 (`/health` returns `contractVersion: 2`).

---

## 2. Step-by-Step Deployment Order

### Step 1: Pre-Deployment Evaluation (Run Locally With Your Key)
Before pushing or deploying any code, run the 25-food evaluation script locally from `gymos-proxy`:
```bash
GEMINI_API_KEY=<your-key> npm run eval:estimates -- --compare
```
1. Verify that the comparative report shows the New Phase D Prompt improving accuracy on category classification, portions, and zero-calorie rules compared to the legacy prompt.
2. If testing only the new prompt:
   ```bash
   GEMINI_API_KEY=<your-key> npm run eval:estimates -- --prompt=new
   ```
3. Pacing (800ms) and automatic 429 exponential backoff are built into the script. If an unknown model or invalid key is configured, the script fails loudly with HTTP 404 rather than reporting false 0% scores.

---

### Step 2: Deploy the Proxy with NO Shared Secret (and `GROUNDING_ENABLED=false`)
1. Merge branch `feat/proxy-phase-d` into `main` in `gymos-proxy` (or point Render service at `feat/proxy-phase-d`).
2. In Render Dashboard -> Environment Settings:
   - Ensure `GEMINI_API_KEY` is set.
   - Keep `GROUNDING_ENABLED=false` (or leave it unset; defaults to false) for the initial deployment.
   - **DO NOT** set `GYMOS_SHARED_SECRET` yet (leave it blank or undefined).
3. Trigger Render deploy (`Manual Deploy` -> `Deploy latest commit`).
4. Wait for Render build to complete and service status to report "Live".

---

### Step 3: Check `/health` Endpoint on Render
1. Execute from your workstation or terminal:
   ```bash
   curl -i https://<your-render-proxy-url>/health
   ```
2. Verify:
   - HTTP status code is `200 OK`.
   - Response body contains:
     ```json
     {"status":"ok","version":2,"contractVersion":2,"model":"gemini-3.5-flash-lite","endpoints":["/estimate","/health"]}
     ```
   - Check `HEAD /status` also returns `200 OK`.
3. Check Render server logs:
   - Verify the startup logs report:
     ```text
     [proxy] Configured Gemini model: "gemini-3.5-flash-lite" (timeout: 60000ms)
     [proxy] Client IP resolution configured: cf-connecting-ip -> true-client-ip -> socket.remoteAddress (untrusted x-forwarded-for ignored)
     ```
4. Note: Because no secret is required yet, existing app builds continue to work uninterrupted.

---

### Step 4: Add the Shared Secret to the App and Verify It
1. Generate a strong random shared secret:
   ```bash
   openssl rand -hex 24
   ```
2. Set the secret in the app environment (`.env` or EAS secrets):
   ```env
   EXPO_PUBLIC_GYMOS_SHARED_SECRET=<your-random-secret>
   ```
3. Test in the mobile app:
   - Open the Nourish tab.
   - Enter a food not in local catalog (e.g. `"1 sattu paratha"`).
   - The app sends `x-gymos-secret: <your-random-secret>`.
   - Because the proxy does not have `GYMOS_SHARED_SECRET` set yet, it ignores unknown headers and responds with `200 OK`.
   - Check Render server logs: verify `ip_source="cf-connecting-ip"` (or `"socket.remoteAddress"`) is logged.
   - Verify that meal resolution succeeds.

---

### Step 5: Set the Same Shared Secret on the Proxy
1. In Render Dashboard -> Environment Settings:
   - Add `GYMOS_SHARED_SECRET=<your-random-secret>`.
2. Save changes (Render will perform a zero-downtime rolling restart).
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

### Step 6: (Optional Later Phase) Enabling Web Search Grounding
1. Check your Gemini API tier and search billing allowance at https://ai.google.dev/pricing.
2. In Render Dashboard, set `GROUNDING_ENABLED=true`.
3. If the configured model or tier does not support search grounding, the proxy automatically catches the HTTP 4xx, logs a warning, permanently disables grounding for that process, and falls back to standard model estimation without failing requests.

---

## 3. Rollback Procedure

If any step fails or upstream anomalies occur:

### Rollback Proxy Secret
1. If clients receive unexpected 401 errors, remove `GYMOS_SHARED_SECRET` from Render environment variables and save.
2. The proxy immediately permits requests without the secret header.

### Rollback Proxy Code
1. In Render Dashboard, click **Deploys**.
2. Find the previous successful deployment commit (`f07c424` or previous release).
3. Click **Rollback to this deploy**.
4. Confirm `/health` responds with 200 OK.
5. Client tolerance: GymOS app tolerates legacy contract version 1 seamlessly.
