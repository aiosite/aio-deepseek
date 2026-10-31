import { describe, expect, it } from "vitest";
import { parseBdsMessage } from "./index.js";

const SCORE = "tempo: 96\ntrack Melody instrument=piano\nC4/4 E4/4 G4/2";

describe("AIO:midi parser", () => {
  it("parses a paired <AIO:midi> tag", () => {
    const result = parseBdsMessage(`Here is your tune:\n<AIO:midi>${SCORE}</AIO:midi>\nEnjoy!`);

    expect(result.renderableBlocks).toHaveLength(1);
    expect(result.renderableBlocks[0]).toMatchObject({ name: "midi", content: SCORE });
    expect(result.visibleText).toContain("\x00BLOCK:0\x00");
    expect(result.visibleText).toContain("Here is your tune:");
    expect(result.visibleText).toContain("Enjoy!");
  });

  it("handles case-insensitive <AIO:MIDI> tags and keeps attributes", () => {
    const raw = `<AIO:MIDI title="Night Drive">C4/4</AIO:MIDI>`;
    const result = parseBdsMessage(raw);

    expect(result.renderableBlocks).toHaveLength(1);
    expect(result.renderableBlocks[0].name).toBe("midi");
    expect(result.renderableBlocks[0].attrs.title).toBe("Night Drive");
  });

  it("detects streaming state when <AIO:midi> is still open", () => {
    const raw = `Prefix text\n<AIO:midi>\ntempo: 120\nC4/4 E4/4`;
    const result = parseBdsMessage(raw, false);

    expect(result.isStreamingTool).toBe(true);
    expect(result.streamingTagName).toBe("midi");
    expect(result.visibleText).toBe("Prefix text");
  });

  it("auto-closes an unclosed <AIO:midi> when isSettled is true", () => {
    const result = parseBdsMessage(`<AIO:midi>${SCORE}`, true);

    expect(result.renderableBlocks).toHaveLength(1);
    expect(result.renderableBlocks[0].name).toBe("midi");
  });

  it("ignores <AIO:midi> inside markdown code blocks", () => {
    const raw = "```html\n<AIO:midi>C4/4</AIO:midi>\n```";
    const result = parseBdsMessage(raw);

    expect(result.renderableBlocks).toHaveLength(0);
    expect(result.visibleText).toContain("&lt;AIO:midi>");
  });

  it("unwraps markdown code fences inside <AIO:midi>", () => {
    const raw = `<AIO:midi>\n\`\`\`\nC4/4 E4/4\n\`\`\`\n</AIO:midi>`;
    const result = parseBdsMessage(raw);

    expect(result.renderableBlocks).toHaveLength(1);
    expect(result.renderableBlocks[0].content.trim()).toBe("C4/4 E4/4");
  });

  it("parses a score with several tracks and directives", () => {
    const raw = `<AIO:midi>
title: Evening Loop
tempo: 96
track Melody instrument=piano
C4/4 E4/4 G4/4 A4/4 | G4/2 R/2
track "Bass Line" instrument=bass
C2/2 C2/2 A1/2 A1/2
</AIO:midi>`;
    const result = parseBdsMessage(raw);

    expect(result.renderableBlocks).toHaveLength(1);
    expect(result.renderableBlocks[0].content).toContain("Evening Loop");
    expect(result.renderableBlocks[0].content).toContain("Bass Line");
  });
});
