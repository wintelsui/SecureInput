import test from "node:test";
import assert from "node:assert/strict";
import {
  applyInputOperation,
  maskValue,
  normalizeValue,
  sanitizeInput,
} from "../src/core/secureInputCore.js";

test("sanitizeInput keeps only letters and numbers", () => {
  assert.equal(sanitizeInput("12ab-_*中文3"), "12ab3");
});

test("normalizeValue applies sanitize and maxlength", () => {
  assert.equal(normalizeValue("a1b2c3", 4), "a1b2");
});

test("maskValue follows head/tail masking rule", () => {
  assert.equal(maskValue("123456"), "12**56");
  assert.equal(maskValue("1234567"), "12***67");
  assert.equal(maskValue("12345678"), "12****78");
});

test("insert text into middle position", () => {
  const result = applyInputOperation({
    currentValue: "123456",
    inputType: "insertText",
    data: "a",
    selectionStart: 2,
    selectionEnd: 2,
    maxLength: 20,
  });

  assert.deepEqual(result, { value: "12a3456", caret: 3 });
});

test("replace a range with filtered paste content", () => {
  const result = applyInputOperation({
    currentValue: "12ab56",
    inputType: "insertFromPaste",
    data: "中文-99",
    selectionStart: 2,
    selectionEnd: 4,
    maxLength: 20,
  });

  assert.deepEqual(result, { value: "129956", caret: 4 });
});

test("delete backward on collapsed selection", () => {
  const result = applyInputOperation({
    currentValue: "12ab56",
    inputType: "deleteContentBackward",
    selectionStart: 4,
    selectionEnd: 4,
    maxLength: 20,
  });

  assert.deepEqual(result, { value: "12a56", caret: 3 });
});

test("delete forward on collapsed selection", () => {
  const result = applyInputOperation({
    currentValue: "12ab56",
    inputType: "deleteContentForward",
    selectionStart: 2,
    selectionEnd: 2,
    maxLength: 20,
  });

  assert.deepEqual(result, { value: "12b56", caret: 2 });
});

test("insert operation obeys maxlength", () => {
  const result = applyInputOperation({
    currentValue: "1234",
    inputType: "insertText",
    data: "56789",
    selectionStart: 4,
    selectionEnd: 4,
    maxLength: 6,
  });

  assert.deepEqual(result, { value: "123456", caret: 6 });
});

test("unsupported inputType returns null", () => {
  const result = applyInputOperation({
    currentValue: "1234",
    inputType: "historyUndo",
    data: null,
    selectionStart: 4,
    selectionEnd: 4,
    maxLength: 6,
  });

  assert.equal(result, null);
});
