import { createElement } from "react";
import { Text } from "react-native";
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
} from "@/components/ds";

jest.mock("@/global.css", () => ({}));

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

  it("renders Seg segmented control", () => {
    const options = [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ];
    const r = render(createElement(Seg, { options, value: "a", onChange: () => {} }));
    expect(r.toJSON()).toBeTruthy();
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

  it("renders Sheet", () => {
    const r = render(createElement(Sheet, { visible: true, onClose: () => {}, title: "Test Sheet" }, createElement(Text, null, "Content")));
    expect(r.toJSON()).toBeTruthy();
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
});
