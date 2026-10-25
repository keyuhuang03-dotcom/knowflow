import { test } from "node:test";
import assert from "node:assert/strict";
import { solutionSteps } from "../src/lib/solution-steps";
test("split explicit solution steps without breaking TeX or decimal values", () => {
  assert.deepEqual(solutionSteps("1. 令 $p=y'$。\n2. 得 $p\\frac{dp}{dy}=0$。"), ["令 $p=y'$。", "得 $p\\frac{dp}{dy}=0$。"]);
  assert.equal(solutionSteps("1. 使用公式。2. 得到 $2x$。").length, 2);
  assert.deepEqual(solutionSteps("结果 $1. 2$，取值 1.25。"), ["结果 $1. 2$，取值 1.25。"]);
  assert.deepEqual(solutionSteps("1. 条件。\n3. 非连续编号。"), ["1. 条件。\n3. 非连续编号。"]);
});
