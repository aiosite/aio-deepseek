import { describe, expect, it } from "vitest";
import { parseBdsMessage } from "./index.js";

describe("IMAGE paired tag", () => {
  it("parses a paired IMAGE tag with content as query", () => {
    const result = parseBdsMessage('<AIO:IMAGE>sunset landscape</AIO:IMAGE>');
    expect(result.renderableBlocks).toHaveLength(1);
    expect(result.renderableBlocks[0]).toMatchObject({
      name: "image",
      content: "sunset landscape",
    });
  });

  it("preserves whitespace from paired tag content (no trimming)", () => {
    const result = parseBdsMessage('<AIO:IMAGE>  mountain view  </AIO:IMAGE>');
    expect(result.renderableBlocks[0].content).toBe("  mountain view  ");
  });

  it("parses paired tag with attributes", () => {
    const result = parseBdsMessage('<AIO:IMAGE count="3" filetype="image/jpeg">cat</AIO:IMAGE>');
    expect(result.renderableBlocks).toHaveLength(1);
    expect(result.renderableBlocks[0]).toMatchObject({
      name: "image",
      content: "cat",
      attrs: { count: "3", filetype: "image/jpeg" },
    });
  });
});

describe("IMAGE self-closing tag", () => {
  it("parses self-closing tag with no space before attributes (<AIO:IMAGE query=.../>)", () => {
    const result = parseBdsMessage('<AIO:IMAGE query="beach"/>');
    expect(result.renderableBlocks).toHaveLength(1);
    expect(result.renderableBlocks[0].content).toBe("beach");
  });

  it("parses self-closing tag with no space and no attributes (<AIO:IMAGE/>)", () => {
    const result = parseBdsMessage('<AIO:IMAGE/>');
    expect(result.renderableBlocks).toHaveLength(0);
  });

  it("parses self-closing tag with query attribute", () => {
    const result = parseBdsMessage('<AIO:IMAGE query="beach" />');
    expect(result.renderableBlocks).toHaveLength(1);
    expect(result.renderableBlocks[0]).toMatchObject({
      name: "image",
      content: "beach",
      attrs: { query: "beach" },
    });
  });

  it("parses self-closing tag with q alias", () => {
    const result = parseBdsMessage('<AIO:IMAGE q="forest" />');
    expect(result.renderableBlocks).toHaveLength(1);
    expect(result.renderableBlocks[0].attrs.q).toBe("forest");
    expect(result.renderableBlocks[0].content).toBe("forest");
  });

  it("parses self-closing tag with search alias", () => {
    const result = parseBdsMessage('<AIO:IMAGE search="ocean" />');
    expect(result.renderableBlocks).toHaveLength(1);
    expect(result.renderableBlocks[0].content).toBe("ocean");
  });

  it("parses self-closing tag with src attribute (direct URL)", () => {
    const result = parseBdsMessage('<AIO:IMAGE src="https://example.com/img.jpg" />');
    expect(result.renderableBlocks).toHaveLength(1);
    expect(result.renderableBlocks[0]).toMatchObject({
      name: "image",
      content: "",
      attrs: { src: "https://example.com/img.jpg" },
    });
  });

  it("parses self-closing tag with src + caption", () => {
    const result = parseBdsMessage('<AIO:IMAGE src="https://example.com/pic.png" caption="A nice picture" />');
    expect(result.renderableBlocks).toHaveLength(1);
    expect(result.renderableBlocks[0].attrs).toMatchObject({
      src: "https://example.com/pic.png",
      caption: "A nice picture",
    });
  });

  it("unwraps markdown-formatted link inside src attribute", () => {
    const result = parseBdsMessage('<AIO:IMAGE src="[https://cataas.com/cat](https://cataas.com/cat)" width="500" caption="Cat"></AIO:IMAGE>');
    expect(result.renderableBlocks).toHaveLength(1);
    expect(result.renderableBlocks[0].attrs.src).toBe("https://cataas.com/cat");
  });

  it("does not duplicate self-closing image tag when message is settled", () => {
    const text = '<AIO:IMAGE src="https://cataas.com/cat" caption="Here\'s a random cat for you! 🐱" width="400" />';
    const result = parseBdsMessage(text, true);
    expect(result.renderableBlocks).toHaveLength(1);
    expect(result.isStreamingTool).toBe(false);
  });

  it("does not set isStreamingTool to true for image tags during streaming", () => {
    const text = '<AIO:IMAGE src="https://cataas.com/cat" caption="Cat" width="400" />';
    const result = parseBdsMessage(text, false);
    expect(result.isStreamingTool).toBe(false);
  });

  it("ignores empty self-closing tag with no relevant attributes", () => {
    const result = parseBdsMessage('<AIO:IMAGE style="width:100px" />');
    expect(result.renderableBlocks).toHaveLength(0);
  });

  it("ignores self-closing tag with only count attribute (no query/src)", () => {
    const result = parseBdsMessage('<AIO:IMAGE count="5" />');
    expect(result.renderableBlocks).toHaveLength(0);
  });
});

describe("IMAGE tag visibility hiding", () => {
  it("marks message as containing control tags", () => {
    const result = parseBdsMessage('<AIO:IMAGE>test</AIO:IMAGE>');
    expect(result.containsControlTags).toBe(true);
  });

  it("strips IMAGE tag from visible text", () => {
    const result = parseBdsMessage('Hello <AIO:IMAGE>test</AIO:IMAGE> world');
    expect(result.visibleText).not.toContain("AIO:IMAGE");
    expect(result.visibleText).not.toContain("test");
  });

  it("strips self-closing IMAGE tag from visible text", () => {
    const result = parseBdsMessage('Look at this: <AIO:IMAGE query="cat" /> cool!');
    expect(result.visibleText).not.toContain("AIO:IMAGE");
    expect(result.visibleText).not.toContain("cat");
  });
});

describe("IMAGE tag with other tool tags", () => {
  it("parses image alongside other renderable blocks", () => {
    const text = '<AIO:IMAGE>dog</AIO:IMAGE>\n<AIO:HTML><p>hello</p></AIO:HTML>';
    const result = parseBdsMessage(text);
    expect(result.renderableBlocks).toHaveLength(2);
    expect(result.renderableBlocks[0].name).toBe("image");
    expect(result.renderableBlocks[1].name).toBe("html");
  });
});
