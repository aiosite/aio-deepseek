import { describe, expect, it } from "vitest";

import {
  parseTagAttributes,
  scanBdsTagOpenings,
  scanBdsTagPairs,
} from "./tag-parser.js";

describe("scanBdsTagOpenings", () => {
  it("returns nothing when there is no tag", () => {
    expect(scanBdsTagOpenings("just prose", "image")).toEqual([]);
    expect(scanBdsTagOpenings("", "image")).toEqual([]);
    expect(scanBdsTagOpenings(undefined, "image")).toEqual([]);
  });

  it("finds an opening tag and reports its raw attributes", () => {
    const text = '<AIO:IMAGE src="a.png">';
    const [tag] = scanBdsTagOpenings(text, "image");

    expect(tag.name).toBe("image");
    expect(tag.attrsRaw).toBe(' src="a.png"');
    expect(tag.index).toBe(0);
    expect(tag.openEnd).toBe(text.length);
    expect(tag.selfClosing).toBe(false);
    expect(tag.closed).toBe(true);
  });

  it("matches the tag name case-insensitively", () => {
    expect(scanBdsTagOpenings("<bds:image src=\"a\">", "IMAGE")).toHaveLength(1);
    expect(scanBdsTagOpenings("<AIO:Image src=\"a\">", "image")).toHaveLength(1);
  });

  it("accepts an AUTO: prefixed tag only when that spelling is requested", () => {
    expect(scanBdsTagOpenings('<AIO:AUTO:FILE_READ path="a">', "file_read")).toEqual([]);
    const [tag] = scanBdsTagOpenings('<AIO:AUTO:FILE_READ path="a">', ["file_read", "auto:file_read"]);
    expect(tag.name).toBe("auto:file_read");
  });

  it("matches every tag when asked for any name", () => {
    const tags = scanBdsTagOpenings("<AIO:A>x<AIO:B:Y>y<AIO:IMAGE src=\"a\">", "*");
    expect(tags.map((t) => t.name)).toEqual(["a", "b:y", "image"]);

    expect(scanBdsTagOpenings("<AIO:A>x", undefined).map((t) => t.name)).toEqual(["a"]);
  });

  it("does not match a different tag name", () => {
    expect(scanBdsTagOpenings('<AIO:MEMORY_WRITE note="x">', "image")).toEqual([]);
  });

  it("does not treat a closing tag as an opening", () => {
    expect(scanBdsTagOpenings("</AIO:IMAGE>", "image")).toEqual([]);
  });

  it("reports self-closing tags and keeps the slash out of the attributes", () => {
    const [tag] = scanBdsTagOpenings('<AIO:IMAGE src="a.png" />', "image");

    expect(tag.selfClosing).toBe(true);
    expect(tag.attrsRaw).toBe(' src="a.png" ');
    expect(parseTagAttributes(tag.attrsRaw)).toEqual({ src: "a.png" });
  });

  it("finds multiple openings in document order", () => {
    const tags = scanBdsTagOpenings('<AIO:IMAGE src="a">x<AIO:IMAGE src="b">', "image");
    expect(tags.map((t) => t.attrsRaw)).toEqual([' src="a"', ' src="b"']);
    expect(tags[0].index).toBeLessThan(tags[1].index);
  });

  it("does not truncate at a > inside a double-quoted value", () => {
    const text = '<AIO:IMAGE src="https://x/p.png" caption="a > b" />';
    const [tag] = scanBdsTagOpenings(text, "image");

    expect(tag.attrsRaw).toBe(' src="https://x/p.png" caption="a > b" ');
    expect(parseTagAttributes(tag.attrsRaw)).toEqual({
      src: "https://x/p.png",
      caption: "a > b",
    });
  });

  it("does not truncate at a > inside a single-quoted value", () => {
    const [tag] = scanBdsTagOpenings("<AIO:IMAGE caption='a > b' />", "image");

    expect(tag.attrsRaw).toBe(" caption='a > b' ");
    expect(parseTagAttributes(tag.attrsRaw)).toEqual({ caption: "a > b" });
  });

  it("keeps a payload quote inside a quoted value", () => {
    const [tag] = scanBdsTagOpenings('<AIO:IMAGE caption="a "b" c">', "image");

    expect(tag.attrsRaw).toBe(' caption="a "b" c"');
    expect(parseTagAttributes(tag.attrsRaw)).toEqual({ caption: 'a "b" c' });
  });

  it("keeps an apostrophe inside a double-quoted value", () => {
    const [tag] = scanBdsTagOpenings('<AIO:IMAGE caption="it\'s > fine">', "image");

    expect(parseTagAttributes(tag.attrsRaw)).toEqual({ caption: "it's > fine" });
  });

  it("honours an escaped quote", () => {
    const [tag] = scanBdsTagOpenings('<AIO:IMAGE caption="say \\"hi\\" > there">', "image");

    expect(parseTagAttributes(tag.attrsRaw)).toEqual({ caption: 'say "hi" > there' });
  });

  it("handles a bare > in an unquoted value", () => {
    const [tag] = scanBdsTagOpenings("<AIO:IMAGE src=a.png>", "image");
    expect(tag.attrsRaw).toBe(" src=a.png");
  });

  it("reports an unterminated opening as unclosed", () => {
    const [tag] = scanBdsTagOpenings('<AIO:IMAGE src="a.png"', "image");

    expect(tag.closed).toBe(false);
    expect(tag.attrsRaw).toBe(' src="a.png"');
    expect(tag.openEnd).toBe(22);
  });

  it("reports an opening whose quote never closes as unclosed", () => {
    const [tag] = scanBdsTagOpenings('<AIO:IMAGE caption="never ends', "image");

    expect(tag.closed).toBe(false);
    expect(tag.attrsRaw).toBe(' caption="never ends');
  });

  it("returns an empty attribute list for a bare opening", () => {
    const [tag] = scanBdsTagOpenings("<AIO:LONG_WORK>", "long_work");
    expect(tag.attrsRaw).toBe("");
    expect(parseTagAttributes(tag.attrsRaw)).toEqual({});
  });

  it("accepts a list of names", () => {
    const tags = scanBdsTagOpenings("<AIO:A>x<AIO:B>y<AIO:C>z", ["a", "c"]);
    expect(tags.map((t) => t.name)).toEqual(["a", "c"]);
  });

  it("stops scanning a malformed prefix without looping", () => {
    expect(() => scanBdsTagOpenings("<AIO:>x<AIO:IMAGE src=\"a\">", "image")).not.toThrow();
    const tags = scanBdsTagOpenings('<AIO:>x<AIO:IMAGE src="a">', "image");
    expect(tags.map((t) => t.name)).toEqual(["image"]);
  });
});

describe("scanBdsTagPairs", () => {
  it("extracts the body between an opening and its close tag", () => {
    const text = "<AIO:AUTO:SEARCH>cats</AIO:AUTO:SEARCH>";
    const [tag] = scanBdsTagPairs(text, ["search", "auto:search"]);

    expect(tag.body).toBe("cats");
    expect(tag.paired).toBe(true);
    expect(tag.index).toBe(0);
    expect(tag.endIndex).toBe(text.length);
    expect(tag.raw).toBe(text);
  });

  it("matches the close tag case-insensitively", () => {
    const [tag] = scanBdsTagPairs("<AIO:AUTO:SEARCH>cats</bds:auto:search>", ["search", "auto:search"]);
    expect(tag.body).toBe("cats");
    expect(tag.paired).toBe(true);
  });

  it("pairs with the first close tag", () => {
    const [tag] = scanBdsTagPairs("<AIO:X>a</AIO:X>b</AIO:X>", "x");
    expect(tag.body).toBe("a");
    expect(tag.endIndex).toBe("<AIO:X>a</AIO:X>".length);
  });

  it("returns an unclosed opening with an empty body", () => {
    const [tag] = scanBdsTagPairs('<AIO:AUTO:FILE_READ path="a.py">', ["file_read", "auto:file_read"]);

    expect(tag.paired).toBe(false);
    expect(tag.body).toBe("");
    expect(tag.raw).toBe('<AIO:AUTO:FILE_READ path="a.py">');
    expect(tag.endIndex).toBe(tag.openEnd);
  });

  it("skips self-closing tags", () => {
    expect(scanBdsTagPairs('<AIO:IMAGE src="a.png" />', "image")).toEqual([]);
  });

  it("includes self-closing tags when asked, with an empty body", () => {
    const [tag] = scanBdsTagPairs(
      '<AIO:AUTO:FILE_READ path="src/index.js"/>',
      ["file_read", "auto:file_read"],
      { includeSelfClosing: true }
    );

    expect(tag.selfClosing).toBe(true);
    expect(tag.paired).toBe(false);
    expect(tag.body).toBe("");
    expect(tag.raw).toBe('<AIO:AUTO:FILE_READ path="src/index.js"/>');
    expect(parseTagAttributes(tag.attrsRaw)).toEqual({ path: "src/index.js" });
  });

  it("still skips self-closing tags when the option is false", () => {
    const tags = scanBdsTagPairs('<AIO:X/>', "x", { includeSelfClosing: false });
    expect(tags).toEqual([]);
  });

  it("does not truncate attributes at a > inside a quoted value", () => {
    const text = '<AIO:CHART title="Revenue > Costs">{"x":1}</AIO:CHART>';
    const [tag] = scanBdsTagPairs(text, "chart");

    expect(tag.attrsRaw).toBe(' title="Revenue > Costs"');
    expect(parseTagAttributes(tag.attrsRaw)).toEqual({ title: "Revenue > Costs" });
    expect(tag.body).toBe('{"x":1}');
  });

  it("leaves > and < inside the body alone", () => {
    const [tag] = scanBdsTagPairs("<AIO:X>a > b < c</AIO:X>", "x");
    expect(tag.body).toBe("a > b < c");
  });

  it("finds multiple pairs in document order", () => {
    const tags = scanBdsTagPairs("<AIO:X>1</AIO:X> mid <AIO:X>2</AIO:X>", "x");
    expect(tags.map((t) => t.body)).toEqual(["1", "2"]);
  });

  it("ignores text outside the tags", () => {
    const [tag] = scanBdsTagPairs("before <AIO:X>body</AIO:X> after", "x");
    expect(tag.body).toBe("body");
    expect(tag.raw).toBe("<AIO:X>body</AIO:X>");
    expect(tag.index).toBe(7);
  });

  it("handles an empty body", () => {
    const [tag] = scanBdsTagPairs("<AIO:X></AIO:X>", "x");
    expect(tag.body).toBe("");
    expect(tag.paired).toBe(true);
  });

  it("returns nothing for a tag of another name", () => {
    expect(scanBdsTagPairs("<AIO:X>a</AIO:X>", "y")).toEqual([]);
  });
});
