import { describe, expect, it } from "vitest";
import { parseBdsMessage } from "./index.js";

describe("AIO:chart parser", () => {
  it("parses paired <AIO:chart> tag with Vega-Lite JSON", () => {
    const spec = JSON.stringify({
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      title: { text: "Test Chart", subtitle: "Test Subtitle" },
      data: { values: [{ x: 1, y: 10 }] },
      mark: "bar",
      encoding: {
        x: { field: "x", type: "ordinal" },
        y: { field: "y", type: "quantitative" },
      },
    });

    const result = parseBdsMessage(`Here is your chart:\n<AIO:chart>${spec}</AIO:chart>\nHope you like it!`);
    expect(result.renderableBlocks).toHaveLength(1);
    expect(result.renderableBlocks[0]).toMatchObject({
      name: "chart",
      content: spec,
    });
    expect(result.visibleText).toContain("\x00BLOCK:0\x00");
    expect(result.visibleText).toContain("Here is your chart:");
    expect(result.visibleText).toContain("Hope you like it!");
  });

  it("handles case-insensitive <AIO:CHART> tags", () => {
    const raw = `<AIO:CHART title="Game Prices">{ "$schema": "https://vega.github.io/schema/vega-lite/v5.json" }</AIO:CHART>`;
    const result = parseBdsMessage(raw);
    expect(result.renderableBlocks).toHaveLength(1);
    expect(result.renderableBlocks[0].name).toBe("chart");
    expect(result.renderableBlocks[0].attrs.title).toBe("Game Prices");
  });

  it("detects streaming state when <AIO:chart> is open", () => {
    const raw = `Prefix text\n<AIO:chart>\n{ "data": [1, 2, 3]`;
    const result = parseBdsMessage(raw, false);
    expect(result.isStreamingTool).toBe(true);
    expect(result.streamingTagName).toBe("chart");
    expect(result.visibleText).toBe("Prefix text");
  });

  it("auto-closes unclosed <AIO:chart> when isSettled is true", () => {
    const spec = `{"mark": "line"}`;
    const raw = `<AIO:chart>${spec}`;
    const result = parseBdsMessage(raw, true);
    expect(result.renderableBlocks).toHaveLength(1);
    expect(result.renderableBlocks[0].name).toBe("chart");
  });

  it("ignores <AIO:chart> inside markdown code blocks", () => {
    const raw = "```html\n<AIO:chart>{\"mark\": \"bar\"}</AIO:chart>\n```";
    const result = parseBdsMessage(raw);
    expect(result.renderableBlocks).toHaveLength(0);
    expect(result.visibleText).toContain("&lt;AIO:chart>");
  });

  it("parses the user's video game prices vs inflation example correctly", () => {
    const userPromptExample = `<AIO:chart>
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "width": "container",
  "title": {
    "text": "Video Oyunu Fiyatları vs Enflasyon",
    "subtitle": "Nominal fiyat yükselse de enflasyona göre 1990'daki 55$ oyun bugünün parasıyla ~130$"
  },
  "data": {
    "values": [
      { "yil": "1977", "tur": "Nominal fiyat (USD)", "fiyat": 30 },
      { "yil": "1977", "tur": "Enflasyona göre (bugünkü USD)", "fiyat": 195 },
      { "yil": "1990", "tur": "Nominal fiyat (USD)", "fiyat": 55 },
      { "yil": "2026", "tur": "Enflasyona göre (bugünkü USD)", "fiyat": 80 }
    ]
  },
  "mark": {
    "type": "line",
    "point": true,
    "interpolate": "monotone"
  },
  "encoding": {
    "x": { "field": "yil", "type": "ordinal", "title": "Yıl" },
    "y": { "field": "fiyat", "type": "quantitative", "title": "Fiyat (USD)" },
    "color": { "field": "tur", "type": "nominal", "legend": { "title": "Fiyat türü" } }
  }
}
</AIO:chart>`;

    const result = parseBdsMessage(userPromptExample);
    expect(result.renderableBlocks).toHaveLength(1);
    expect(result.renderableBlocks[0].name).toBe("chart");
    expect(result.renderableBlocks[0].content).toContain("Video Oyunu Fiyatları vs Enflasyon");
    expect(result.renderableBlocks[0].content).toContain("Nominal fiyat (USD)");
  });

  it("unwraps markdown code fences inside <AIO:chart>", () => {
    const raw = `<AIO:chart>\n\`\`\`json\n{"mark": "bar"}\n\`\`\`\n</AIO:chart>`;
    const result = parseBdsMessage(raw);
    expect(result.renderableBlocks).toHaveLength(1);
    expect(result.renderableBlocks[0].content.trim()).toBe('{"mark": "bar"}');
  });
});
