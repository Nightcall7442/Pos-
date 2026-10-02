import { describe, expect, it } from "vitest";
import { contrastRatio, readableOn } from "./contrast";

describe("подпись на цвете категории", () => {
  it("считает контраст по WCAG", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 0);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrastRatio("#c8402b", "#ffffff")).toBeCloseTo(4.97, 1);
  });

  it("на светлом и ярком — графит, на тёмном — белый", () => {
    expect(readableOn("#f59e0b")).toBe("#15191b"); // жёлтый: белый был бы 2.2
    expect(readableOn("#10b981")).toBe("#15191b");
    expect(readableOn("#2c3540")).toBe("#ffffff");
    expect(readableOn("#62799a")).toBe("#ffffff");
  });

  it("на непонятном цвете — графит, а не белый на белом", () => {
    expect(readableOn(undefined)).toBe("#15191b");
    expect(readableOn("var(--gray-200)")).toBe("#15191b");
    expect(readableOn("#fff")).toBe("#15191b");
  });
});
