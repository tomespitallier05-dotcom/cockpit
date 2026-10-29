import assert from "node:assert/strict";
import { test } from "node:test";
import { servedFile } from "../../src/lib/safe-file";

test("les formats sans code s'affichent en ligne, sous leur type exact", () => {
  assert.deepEqual(servedFile("image/png"), { contentType: "image/png", disposition: "inline", sandbox: true });
  assert.equal(servedFile("application/pdf").disposition, "inline");
  assert.equal(servedFile("application/pdf").sandbox, false);
  assert.equal(servedFile("IMAGE/JPEG; charset=binary").contentType, "image/jpeg");
});

test("SVG, HTML et inconnus sont toujours téléchargés comme des octets opaques", () => {
  for (const type of ["image/svg+xml", "text/html", "application/xhtml+xml", "text/xml", "application/javascript", "", "image/svg+xml; charset=utf-8"]) {
    assert.deepEqual(servedFile(type), { contentType: "application/octet-stream", disposition: "attachment", sandbox: true }, type);
  }
});

test("?download=1 force le téléchargement", () => {
  assert.equal(servedFile("image/png", true).disposition, "attachment");
});

// Audit of src/components/markdown.tsx: AI answers (and anything they quote from emails or
// web pages) are untrusted text. The renderer builds React elements only, never raw HTML.
test("markdown : le HTML et les liens piégés restent du texte inerte", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { Markdown } = await import("../../src/components/markdown");
  const hostile = [
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    "**<b onmouseover=alert(1)>gras</b>**",
    "[clic](javascript:alert(1))",
    "`<iframe src=//evil>`",
    "- <a href=\"javascript:alert(1)\">x</a>",
    "# <svg onload=alert(1)>",
    "[1] [2]",
  ].join("\n\n");
  const html = renderToStaticMarkup(
    createElement(Markdown, { text: hostile, citations: [{ n: 1, entryId: "abc", title: '"><script>alert(1)</script>' }] }),
  );
  assert.ok(!/<script|<img|<iframe|<svg|<b |<a href="javascript|onerror=|onload=|onmouseover=/i.test(html.replace(/&lt;[^]*?&gt;/g, "")), html);
  assert.ok(!/href="javascript:/i.test(html), html);
  // Citations only ever link to an entry of the app.
  assert.ok(html.includes('href="/entrees/abc"'), html);
});
