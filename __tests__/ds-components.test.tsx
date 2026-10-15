import { createElement } from "react";
import { StyleSheet, Text } from "react-native";
import { Dumbbell } from "lucide-react-native";

import {
  Card,
  Button,
  Seg,
  Chip,
  IconButton,
  Sheet,
  ListRow,
  PressableScale,
  Eyebrow,
  Label,
  Stat,
  EmptyState,
  Skeleton,
  SkeletonList,
  Bar,
  Field,
  ProgressLine,
  ModuleRow,
  WeekStrip,
  SetBar,
  Stepper,
  QuietTabBar,
  TextLink,
  TextLinkBar,
  Composer,
} from "@/components/ds";

jest.mock("@/global.css", () => ({}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const TestRenderer = require("react-test-renderer");

function render(element: React.ReactElement) {
  let renderer: any;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer;
}

describe("DS Component Kit", () => {
  it("renders Card with tone and without tone", () => {
    const r1 = render(createElement(Card, null, createElement(Text, null, "Hello")));
    expect(r1.toJSON()).toBeTruthy();

    const r2 = render(createElement(Card, { tone: "forge", onPress: () => {} }, createElement(Text, null, "Forge Card")));
    expect(r2.toJSON()).toBeTruthy();
  });

  it("renders Button in all variants", () => {
    const r1 = render(createElement(Button, { label: "Primary", onPress: () => {}, variant: "primary" }));
    expect(r1.toJSON()).toBeTruthy();

    const r2 = render(createElement(Button, { label: "Secondary", onPress: () => {}, variant: "secondary" }));
    expect(r2.toJSON()).toBeTruthy();

    const r3 = render(createElement(Button, { label: "Danger", onPress: () => {}, variant: "danger" }));
    expect(r3.toJSON()).toBeTruthy();

    const r4 = render(createElement(Button, { label: "Busy", onPress: () => {}, busy: true }));
    expect(r4.toJSON()).toBeTruthy();
  });

  it("renders Seg segmented control and gives each tab an equal flex share", () => {
    const options = [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
      { value: "c", label: "C" },
    ];
    const r = render(createElement(Seg, { options, value: "a", onChange: () => {} }));
    expect(r.toJSON()).toBeTruthy();

    // Verify each PressableScale item received flex: 1 on its outer Pressable
    const pressables = r.root.findAllByType(PressableScale);
    expect(pressables).toHaveLength(3);
    for (const p of pressables) {
      const flattened = StyleSheet.flatten(p.props.style);
      expect(flattened).toMatchObject({ flex: 1 });
    }
  });

  it("renders Chip", () => {
    const r = render(createElement(Chip, { label: "Fast", active: true, onPress: () => {} }));
    expect(r.toJSON()).toBeTruthy();
  });

  it("renders IconButton", () => {
    const r = render(createElement(IconButton, { icon: createElement(Dumbbell, { size: 20 }), onPress: () => {}, accessibilityLabel: "Workout" }));
    expect(r.toJSON()).toBeTruthy();
  });

  it("renders ListRow with chevron and trailing", () => {
    const r = render(createElement(ListRow, { title: "Title", subtitle: "Subtitle", showChevron: true, onPress: () => {} }));
    expect(r.toJSON()).toBeTruthy();
  });

  it("renders Sheet with title, children, and footer in both scroll and no-scroll modes", () => {
    const r1 = render(
      createElement(
        Sheet,
        {
          visible: true,
          onClose: () => {},
          title: "Test Sheet",
          footer: createElement(Text, null, "Footer Action"),
        },
        createElement(Text, null, "Visible Body Content"),
      ),
    );
    expect(r1.toJSON()).toBeTruthy();
    const texts1 = r1.root.findAllByType(Text).map((t: any) => t.props.children);
    expect(texts1).toContain("Test Sheet");
    expect(texts1).toContain("Visible Body Content");
    expect(texts1).toContain("Footer Action");

    // Also assert non-scrolling mode
    const r2 = render(
      createElement(
        Sheet,
        {
          visible: true,
          onClose: () => {},
          scroll: false,
          footer: createElement(Text, null, "Footer Action"),
        },
        createElement(Text, null, "Non-scrolling Body"),
      ),
    );
    const texts2 = r2.root.findAllByType(Text).map((t: any) => t.props.children);
    expect(texts2).toContain("Non-scrolling Body");
    expect(texts2).toContain("Footer Action");
  });

  it("renders PressableScale", () => {
    const r = render(createElement(PressableScale, { onPress: () => {} }, createElement(Text, null, "Scale")));
    expect(r.toJSON()).toBeTruthy();
  });

  it("renders Eyebrow, Label, Stat, EmptyState, Skeleton, Bar, Field", () => {
    expect(render(createElement(Eyebrow, null, "Eyebrow")).toJSON()).toBeTruthy();
    expect(render(createElement(Label, null, "Label")).toJSON()).toBeTruthy();
    expect(render(createElement(Stat, { value: 120, unit: "kg", label: "Bench" })).toJSON()).toBeTruthy();
    expect(render(createElement(EmptyState, { title: "Empty", description: "None" })).toJSON()).toBeTruthy();
    expect(render(createElement(Skeleton, { height: 20 })).toJSON()).toBeTruthy();
    expect(render(createElement(SkeletonList, { count: 2, height: 20 })).toJSON()).toBeTruthy();
    expect(render(createElement(Bar, { value: 50, max: 100 })).toJSON()).toBeTruthy();
    expect(render(createElement(Field, { label: "Name", value: "Test" })).toJSON()).toBeTruthy();
  });

  it("renders L · Quiet new primitives", () => {
    // ProgressLine: under budget and over budget
    const pl1 = render(createElement(ProgressLine, { value: 1500, target: 2000 }));
    expect(pl1.toJSON()).toBeTruthy();
    const pl2 = render(createElement(ProgressLine, { value: 2500, target: 2000, showTargetTick: true }));
    expect(pl2.toJSON()).toBeTruthy();

    // ModuleRow
    const mr = render(
      createElement(ModuleRow, {
        title: "Forge",
        accent: "#F0A04B",
        subtitle: "Push · not started",
        action: { label: "Start", onPress: () => {}, variant: "primary" },
        progress: { value: 0, target: 4 },
      }),
    );
    expect(mr.toJSON()).toBeTruthy();

    // WeekStrip
    const ws = render(createElement(WeekStrip, { completedDays: [0, 1, 3], todayIndex: 3 }));
    expect(ws.toJSON()).toBeTruthy();

    // SetBar
    const sb = render(createElement(SetBar, { totalSets: 3, completedSets: 1, activeSetIndex: 1 }));
    expect(sb.toJSON()).toBeTruthy();

    // Stepper
    const st = render(createElement(Stepper, { label: "Weight", value: 22, unit: "lb", onIncrement: () => {}, onDecrement: () => {} }));
    expect(st.toJSON()).toBeTruthy();

    // QuietTabBar
    const tb = render(createElement(QuietTabBar, { activeKey: "index", onSelectTab: () => {} }));
    expect(tb.toJSON()).toBeTruthy();

    // TextLink & TextLinkBar
    const tl = render(createElement(TextLink, { label: "Weigh in", onPress: () => {}, showBullet: true }));
    expect(tl.toJSON()).toBeTruthy();
    const tlb = render(
      createElement(TextLinkBar, {
        items: [
          { label: "Weigh in", onPress: () => {} },
          { label: "Sleep", onPress: () => {} },
        ],
      }),
    );
    expect(tlb.toJSON()).toBeTruthy();

    // Composer
    const comp = render(createElement(Composer, { value: "2 rotis", onChangeText: () => {}, onSubmit: () => {} }));
    expect(comp.toJSON()).toBeTruthy();
  });
});
