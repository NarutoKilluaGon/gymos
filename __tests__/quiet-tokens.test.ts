import { Q } from "@/constants/quiet";
import { HOME, FORGE, NOURISH, getTheme, Metric, Radius, Font, Type } from "@/constants/design";
import { F } from "@/constants/forge-theme";
import { N } from "@/constants/nourish-theme";
import { GymColors } from "@/constants/theme";

describe("L · Quiet Tokens", () => {
  test("palette tokens have exact hex values", () => {
    expect(Q.color.bg).toBe("#141311");
    expect(Q.color.ink).toBe("#F2EEE6");
    expect(Q.color.mute).toBe("#8F8A80");
    expect(Q.color.line).toBe("#2B2924");
    expect(Q.color.lineStrong).toBe("#3A3731");
    expect(Q.color.surface).toBe("#1B1A17");
    expect(Q.color.surface2).toBe("#23211D");
    expect(Q.color.scrim).toBe("rgba(0, 0, 0, 0.6)");
  });

  test("accents match module definitions", () => {
    expect(Q.accent.brass).toBe("#C9A25A");
    expect(Q.accent.ember).toBe("#F0A04B");
    expect(Q.accent.sage).toBe("#8CC5A2");
    expect(Q.accent.periwinkle).toBe("#93A9F2");
    expect(Q.accent.cyan).toBe("#6CC4D8");
    expect(Q.accent.red).toBe("#E5534B");
  });

  test("radii match quiet scale", () => {
    expect(Q.radius.none).toBe(0);
    expect(Q.radius.sm).toBe(4);
    expect(Q.radius.md).toBe(8);
    expect(Q.radius.lg).toBe(12);
    expect(Q.radius.xl).toBe(16);
    expect(Q.radius.full).toBe(9999);
  });

  test("hairline metrics", () => {
    expect(Q.line.hair).toBe(1);
    expect(Q.line.regular).toBe(1.5);
    expect(Q.line.strong).toBe(2);
  });

  test("fonts are registered", () => {
    expect(Q.font.displayRegular).toBe("FunnelDisplay-Regular");
    expect(Q.font.displayMedium).toBe("FunnelDisplay-Medium");
    expect(Q.font.displaySemiBold).toBe("FunnelDisplay-SemiBold");
    expect(Q.font.sansRegular).toBe("FunnelSans-Regular");
    expect(Q.font.sansMedium).toBe("FunnelSans-Medium");
    expect(Q.font.sansSemiBold).toBe("FunnelSans-SemiBold");
  });

  test("type scale contains valid numbers and font families", () => {
    for (const [role, spec] of Object.entries(Q.type)) {
      expect(spec).toBeDefined();
      expect(typeof spec.fontSize).toBe("number");
      expect(typeof spec.lineHeight).toBe("number");
      expect(typeof spec.fontFamily).toBe("string");
    }
  });

  test("legacy HOME, FORGE, and NOURISH alias onto Q tokens", () => {
    expect(HOME.bg).toBe(Q.color.bg);
    expect(HOME.ink).toBe(Q.color.ink);
    expect(HOME.line).toBe(Q.color.line);
    expect(HOME.accent).toBe(Q.accent.brass);
    expect(HOME.acc).toBe(Q.accent.brass);

    expect(FORGE.bg).toBe(Q.color.bg);
    expect(FORGE.accent).toBe(Q.accent.ember);
    expect(FORGE.acc).toBe(Q.accent.ember);
    expect(F.acc).toBe(Q.accent.ember);

    expect(NOURISH.bg).toBe(Q.color.bg);
    expect(NOURISH.accent).toBe(Q.accent.sage);
    expect(NOURISH.acc).toBe(Q.accent.sage);
    expect(N.acc).toBe(Q.accent.sage);

    expect(getTheme("home").accent).toBe(Q.accent.brass);
    expect(getTheme("forge").accent).toBe(Q.accent.ember);
    expect(getTheme("nourish").accent).toBe(Q.accent.sage);
  });

  test("GymColors legacy alias maps to HOME", () => {
    expect(GymColors.background.primary).toBe(HOME.bg);
    expect(GymColors.text.primary).toBe(HOME.ink);
    expect(GymColors.semantic.accent).toBe(HOME.acc);
  });
});
