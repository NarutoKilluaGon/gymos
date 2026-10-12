#!/usr/bin/env node
/**
 * scripts/eval-food-logging.ts
 *
 * Evaluation harness for food logging accuracy, coverage, and latency.
 * Modes:
 *   --offline      Run against local catalogue and parsers only (no network).
 *   --proxy <url>  Run with live gymos-proxy HTTP provider at <url>.
 */

import fs from "node:fs";
import path from "node:path";
import { resolveLogText, resolveSegments } from "../src/services/nourish/resolve-log";
import { createRenderDescriptionAiProvider } from "../src/services/meal-description-ai-provider";

type GoldenItem = {
  text: string;
  kcalMin: number;
  kcalMax: number;
  proteinMin: number;
  proteinMax: number;
  source: string;
};

type ItemResult = {
  text: string;
  source: string;
  matchedName?: string;
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  inKcalRange: boolean;
  inProteinRange: boolean;
  latencyMs: number;
  resolved: boolean;
  status: string;
  error?: string;
};

async function main() {
  const args = process.argv.slice(2);
  const isOffline = args.includes("--offline") || !args.includes("--proxy");
  const proxyIndex = args.indexOf("--proxy");
  const proxyUrl = proxyIndex !== -1 && args[proxyIndex + 1] ? args[proxyIndex + 1] : undefined;

  const fixturesPath = path.resolve(__dirname, "../__tests__/fixtures/food-golden.json");
  if (!fs.existsSync(fixturesPath)) {
    console.error(`Golden file not found at ${fixturesPath}`);
    process.exit(1);
  }

  const goldenData: GoldenItem[] = JSON.parse(fs.readFileSync(fixturesPath, "utf-8"));
  console.log(`\n======================================================`);
  console.log(` GymOS Food Logging Evaluation Harness`);
  console.log(` Mode: ${isOffline ? "OFFLINE (local only)" : `PROXY (${proxyUrl})`}`);
  console.log(` Items: ${goldenData.length}`);
  console.log(`======================================================\n`);

  const provider = !isOffline && proxyUrl ? createRenderDescriptionAiProvider({ baseUrl: proxyUrl }) : null;
  const results: ItemResult[] = [];

  for (const item of goldenData) {
    const start = performance.now();
    try {
      // First try resolveSegments
      const segs = await resolveSegments(item.text, {
        saved: [],
        eatingOut: false,
        provider,
      });

      const latencyMs = Math.round(performance.now() - start);

      const firstResolved = segs.find((s) => s.item && s.status !== "needs-input")?.item;

      if (firstResolved && firstResolved.calories > 0) {
        const inKcal =
          firstResolved.calories >= item.kcalMin && firstResolved.calories <= item.kcalMax;
        const inProt =
          firstResolved.protein >= item.proteinMin && firstResolved.protein <= item.proteinMax;

        results.push({
          text: item.text,
          source: firstResolved.source,
          matchedName: firstResolved.name,
          kcal: Math.round(firstResolved.calories),
          protein: Math.round(firstResolved.protein),
          carbs: Math.round(firstResolved.carbs),
          fat: Math.round(firstResolved.fat),
          inKcalRange: inKcal,
          inProteinRange: inProt,
          latencyMs,
          resolved: true,
          status: "RESOLVED",
        });
      } else {
        // Check if resolveLogText got something
        const legacy = await resolveLogText(item.text, {
          saved: [],
          eatingOut: false,
          provider,
        });

        if (legacy.status === "ready" && legacy.items.length > 0) {
          const totalKcal = legacy.items.reduce((s, i) => s + i.calories, 0);
          const totalProt = legacy.items.reduce((s, i) => s + i.protein, 0);
          const inKcal = totalKcal >= item.kcalMin && totalKcal <= item.kcalMax;
          const inProt = totalProt >= item.proteinMin && totalProt <= item.proteinMax;

          results.push({
            text: item.text,
            source: legacy.items[0]?.source ?? "unknown",
            matchedName: legacy.items.map((i) => i.name).join(" + "),
            kcal: Math.round(totalKcal),
            protein: Math.round(totalProt),
            inKcalRange: inKcal,
            inProteinRange: inProt,
            latencyMs,
            resolved: true,
            status: "RESOLVED (LEGACY)",
          });
        } else {
          results.push({
            text: item.text,
            source: "none",
            inKcalRange: false,
            inProteinRange: false,
            latencyMs,
            resolved: false,
            status: "UNRESOLVED",
            error: segs[0]?.reason ?? "needs-input",
          });
        }
      }
    } catch (err: any) {
      results.push({
        text: item.text,
        source: "error",
        inKcalRange: false,
        inProteinRange: false,
        latencyMs: Math.round(performance.now() - start),
        resolved: false,
        status: "ERROR",
        error: err?.message,
      });
    }
  }

  // Print results
  for (const r of results) {
    const check = r.inKcalRange ? "✓" : "✗";
    const statusStr = r.resolved
      ? `${r.kcal} kcal [P:${r.protein}] (${r.matchedName})`
      : `FAIL (${r.error ?? "unknown"})`;
    console.log(
      ` ${check} [${r.latencyMs}ms] "${r.text}" -> ${statusStr} [${r.source}]`,
    );
  }

  const resolvedCount = results.filter((r) => r.resolved).length;
  const inRangeCount = results.filter((r) => r.inKcalRange).length;
  const coveragePct = ((resolvedCount / results.length) * 100).toFixed(1);
  const inRangePct = ((inRangeCount / results.length) * 100).toFixed(1);

  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;

  console.log(`\n------------------------------------------------------`);
  console.log(` SUMMARY METRICS (${isOffline ? "OFFLINE" : "PROXY"}):`);
  console.log(` Coverage:          ${resolvedCount}/${results.length} (${coveragePct}%)`);
  console.log(` Within Kcal Range: ${inRangeCount}/${results.length} (${inRangePct}%)`);
  console.log(` Latency:           p50: ${p50}ms, p95: ${p95}ms`);
  console.log(`------------------------------------------------------\n`);
}

main().catch((err) => {
  console.error("Eval script failed:", err);
  process.exit(1);
});
