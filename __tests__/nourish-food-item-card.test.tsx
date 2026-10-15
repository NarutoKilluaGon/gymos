import React from "react";
import renderer, { act } from "react-test-renderer";
import { FoodItemCard } from "@/components/nutrition/food-item-card";
import type { DraftItem } from "@/types/nourish";

describe("FoodItemCard (Forge-style review card)", () => {
  const baseItem: DraftItem = {
    name: "Roti (phulka)",
    qty: "2 piece",
    calories: 160,
    protein: 6,
    carbs: 30,
    fat: 2,
    confidence: 0.85,
    multiplier: 1,
    source: "catalog",
  };

  it("renders name, qty, macros, status chip, and stepper", () => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <FoodItemCard
          item={baseItem}
          status="matched"
          approved={true}
        />,
      );
    });

    const root = tree!.root;
    expect(root.findByProps({ children: "Roti (phulka)" })).toBeDefined();
    expect(root.findByProps({ children: "Matched" })).toBeDefined();
    // Calorie text contains 160
    const textNodes = root.findAllByType("Text" as any);
    const hasCal = textNodes.some((n) => n.props.children === 160 || (Array.isArray(n.props.children) && n.props.children.includes(160)));
    expect(hasCal).toBe(true);
  });

  it("shows 'Needs numbers' chip for 0-calorie items", () => {
    const zeroItem: DraftItem = {
      ...baseItem,
      name: "Keema kaleji",
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      source: "manual",
    };

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <FoodItemCard
          item={zeroItem}
          approved={false}
        />,
      );
    });

    const root = tree!.root;
    expect(root.findByProps({ children: "Needs numbers" })).toBeDefined();
  });

  it("invokes onApproveToggle when checkbox is pressed", () => {
    const onApproveToggle = jest.fn();
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <FoodItemCard
          item={baseItem}
          approved={false}
          onApproveToggle={onApproveToggle}
        />,
      );
    });

    const checkBtn = tree!.root.findByProps({ accessibilityLabel: "Approve Roti (phulka)" });
    act(() => {
      checkBtn.props.onPress();
    });

    expect(onApproveToggle).toHaveBeenCalledWith(true);
  });

  it("invokes onChange with updated multiplier when stepper is tapped", () => {
    const onChange = jest.fn();
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <FoodItemCard
          item={baseItem}
          onChange={onChange}
        />,
      );
    });

    const plusBtn = tree!.root.findByProps({ accessibilityLabel: "Bigger portion" });
    act(() => {
      plusBtn.props.onPress();
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        multiplier: 1.25,
      }),
    );
  });

  it("invokes onRemove when delete button is tapped", () => {
    const onRemove = jest.fn();
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <FoodItemCard
          item={baseItem}
          onRemove={onRemove}
        />,
      );
    });

    const removeBtn = tree!.root.findByProps({ accessibilityLabel: "Remove Roti (phulka)" });
    act(() => {
      removeBtn.props.onPress();
    });

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("shows 'Check this' chip when estimated confidence is low (< 0.6)", () => {
    const lowConfItem: DraftItem = {
      ...baseItem,
      name: "Street chaat",
      confidence: 0.45,
      source: "ai",
    };

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <FoodItemCard item={lowConfItem} status="estimated" />,
      );
    });

    const root = tree!.root;
    expect(root.findByProps({ children: "Check this" })).toBeDefined();
  });

  it("shows 'Estimated' chip when estimated confidence is good (>= 0.6)", () => {
    const highConfItem: DraftItem = {
      ...baseItem,
      name: "Paneer butter masala",
      confidence: 0.85,
      source: "ai",
    };

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <FoodItemCard item={highConfItem} status="estimated" />,
      );
    });

    const root = tree!.root;
    expect(root.findByProps({ children: "Estimated" })).toBeDefined();
  });

  it("renders assumption text when item.assumption is provided", () => {
    const itemWithAssumption: DraftItem = {
      ...baseItem,
      assumption: "Assuming 1 medium bowl cooked with 1 tsp oil",
    };

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <FoodItemCard item={itemWithAssumption} />,
      );
    });

    const root = tree!.root;
    expect(root.findByProps({ children: "Assuming 1 medium bowl cooked with 1 tsp oil" })).toBeDefined();
  });
});
