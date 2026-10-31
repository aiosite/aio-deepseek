import { describe, expect, it } from "vitest";
import { stripInjectedBlocks } from "./payload-mutator.js";

describe("stripInjectedBlocks", () => {
  it("removes hidden context blocks", () => {
    expect(stripInjectedBlocks("<AioDeepSeek>secret</AioDeepSeek>hello")).toBe("hello");
    expect(stripInjectedBlocks("<AIO:SKILLS>x</AIO:SKILLS>hello")).toBe("hello");
    expect(stripInjectedBlocks("<AIO:RP>x</AIO:RP>hello")).toBe("hello");
    expect(stripInjectedBlocks("<AIO:PROJECT>x</AIO:PROJECT>hello")).toBe("hello");
    expect(stripInjectedBlocks("<AIO:PROJECT_CONTEXT>x</AIO:PROJECT_CONTEXT>hello")).toBe("hello");
  });

  it("keeps explicit tool-control messages the model must see", () => {
    const auto = "<AioDeepSeek>[AIO:AUTO]do it</AioDeepSeek>";
    expect(stripInjectedBlocks(auto)).toBe(auto);

    const research = "<AioDeepSeek>[AIO:DEEP_RESEARCH]go</AioDeepSeek>";
    expect(stripInjectedBlocks(research)).toBe(research);

    const memory = '<AioDeepSeek><AIO:memory_calls id="1"></AioDeepSeek>';
    expect(stripInjectedBlocks(memory)).toBe(memory);
  });

  // Regression guard for the `[^>]*` in the paired strips: they are safe only
  // because the matching close tag anchors the removal region. If someone turns
  // them into self-contained strips, the tail of the tag leaks into the prompt.
  it("fully strips paired blocks whose attributes contain '>'", () => {
    expect(stripInjectedBlocks('A<AIO:memory_calls args="a>b">body</AIO:memory_calls>B')).toBe("AB");
    expect(stripInjectedBlocks('A<AIO:PROJECT id="1 > 2">body</AIO:PROJECT>B')).toBe("AB");
  });
});
