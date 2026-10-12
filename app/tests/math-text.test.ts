import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import MathText from "../src/components/wrong-questions/MathText";

test("integral bounds render as native MathML while surrounding text is preserved", () => {
  const html = renderToStaticMarkup(MathText({ children: "设 $\\int_1^{e^x+1} f(t)dt=x$，求 $f(2)$。" }));
  assert.match(html, /<math/);
  assert.match(html, /<msubsup>/);
  assert.match(html, /设/);
  assert.match(html, /求/);
});
test("untrusted math cannot introduce executable links and invalid formula text survives", () => {
  const html = renderToStaticMarkup(MathText({ children: "$\\href{javascript:alert(1)}{click}$ $\\unknownCommand{x}$" }));
  assert.doesNotMatch(html, /<a\b|<script\b|onerror=/);
  assert.match(html, /unknownCommand/);
});
