import { describe, expect, it } from "vitest";
import { sanitizeVisibleText } from "./text-sanitizer.js";

describe("sanitizeVisibleText", () => {
  it("removes AioDeepSeek and AIO control blocks", () => {
    const text = [
      "Visible before",
      "<AioDeepSeek>hidden</AioDeepSeek>",
      "<AIO:VISUALIZER>secret</AIO:VISUALIZER>",
      "Visible after",
    ].join("\n");

    expect(sanitizeVisibleText(text)).toBe("Visible before\n\nVisible after");
  });

  it("removes self-closing create_file tags and long work wrappers", () => {
    const text = '<AIO:LONG_WORK>\nWork\n<AIO:create_file fileName="a.txt" />\n</AIO:LONG_WORK>';
    expect(sanitizeVisibleText(text)).toBe("");
  });

  it("removes unclosed tag fragments", () => {
    expect(sanitizeVisibleText("Hello <AIO:VISUALIZER>world")).toBe("Hello world");
  });

  // Regression: a `>` inside a quoted attribute value used to end the stray-tag
  // capture early, leaving the tail of the tag visible to the user. The scanner
  // reads attribute values as quoted strings, so the whole tag is removed.
  it("removes stray tags whose attributes contain '>'", () => {
    expect(sanitizeVisibleText('A<AIO:memory_calls args="a>b">B')).toBe("AB");
    expect(sanitizeVisibleText('A<AIO:foo x="1 > 2">B')).toBe("AB");
  });

  it("removes self-closing tags whose attributes contain '>'", () => {
    expect(sanitizeVisibleText('A<AIO:create_file fileName="a>b.py"/>B')).toBe("AB");
    expect(
      sanitizeVisibleText('A<AIO:create_file fileName="x.js" content="if (a > b) {}"/>B')
    ).toBe("AB");
  });

  // The paired strips are anchored by the matching close tag, so a truncated
  // attribute capture still removes the same span. These guard that reasoning:
  // if someone rewrites them into self-contained strips, these fail.
  it("still strips paired tags whose attributes contain '>'", () => {
    expect(sanitizeVisibleText('A<AIO:memory_calls args="a>b">body</AIO:memory_calls>B')).toBe("AB");
    expect(
      sanitizeVisibleText('A<AIO:create_file fileName="x.js">if (a > b) {}</AIO:create_file>B')
    ).toBe("AB");
  });

  it("keeps an unterminated tag instead of swallowing the rest of the message", () => {
    expect(sanitizeVisibleText("Hello <AIO:VISUALIZER still typing")).toBe(
      "Hello <AIO:VISUALIZER still typing"
    );
  });

  describe("fence repair (issue #120)", () => {
    it("drops a fence left dangling when a removal took its partner", () => {
      // The removal eats the opening fence because it sits inside the tag span;
      // the closing fence is outside it and would otherwise render as a stray
      // ``` at the end of the message.
      const text = [
        "Intro",
        "",
        '<AIO:create_file fileName="x">',
        "```",
        "</AIO:create_file>",
        "",
        "Prose.",
        "```",
      ].join("\n");

      expect(sanitizeVisibleText(text)).toBe("Intro\n\nProse.");
    });

    it("leaves balanced fences alone", () => {
      const text = ["Intro", "", "```", "code", "```", "", "Prose."].join("\n");

      expect(sanitizeVisibleText(text)).toBe(text);
    });

    it("keeps a block's own fence lines while dropping the dangling one", () => {
      // The inner ```bash belongs to the outer block; only the trailing,
      // unpaired fence is an artifact.
      const text = [
        "Intro",
        "",
        "```",
        "# T",
        "",
        "```bash",
        "run",
        "```",
        "",
        "```",
        "",
        "Prose.",
      ].join("\n");

      expect(sanitizeVisibleText(text)).toBe(
        ["Intro", "", "```", "# T", "", "```bash", "run", "```", "", "Prose."].join("\n")
      );
    });

    it("leaves text without fences untouched", () => {
      const text = ["Intro", "", "plain", "Prose."].join("\n");

      expect(sanitizeVisibleText(text)).toBe(text);
    });
  });
});
