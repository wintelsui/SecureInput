let measureContext = null;

function parsePixelValue(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createFontShorthand(style) {
  if (style.font) {
    return style.font;
  }
  return `${style.fontStyle} ${style.fontVariant} ${style.fontWeight} ${style.fontSize}/${style.lineHeight} ${style.fontFamily}`;
}

function getMeasureContext() {
  if (measureContext) {
    return measureContext;
  }
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  measureContext = canvas.getContext("2d");
  return measureContext;
}

/**
 * 根据当前光标位置调整 input.scrollLeft，保证光标在可视区域内。
 *
 * @param {HTMLInputElement} input - 目标输入框。
 * @param {number} caretIndex - 光标索引。
 * @returns {void}
 */
export function ensureInputCaretVisible(input, caretIndex) {
  if (!input || typeof window === "undefined") {
    return;
  }
  const context = getMeasureContext();
  if (!context) {
    return;
  }

  const value = String(input.value || "");
  const caret = Math.min(Math.max(0, Number(caretIndex) || 0), value.length);
  const style = window.getComputedStyle(input);
  const paddingLeft = parsePixelValue(style.paddingLeft);
  const paddingRight = parsePixelValue(style.paddingRight);
  const letterSpacing = parsePixelValue(style.letterSpacing);
  const contentWidth = Math.max(1, input.clientWidth - paddingLeft - paddingRight);
  const textBeforeCaret = value.slice(0, caret);

  context.font = createFontShorthand(style);
  let caretX = context.measureText(textBeforeCaret).width;
  if (letterSpacing) {
    caretX += Math.max(0, textBeforeCaret.length - 1) * letterSpacing;
  }

  const margin = 2;
  const currentScroll = input.scrollLeft;
  const leftEdge = currentScroll + margin;
  const rightEdge = currentScroll + contentWidth - margin;
  let nextScroll = currentScroll;

  if (caretX > rightEdge) {
    nextScroll = caretX - contentWidth + margin;
  } else if (caretX < leftEdge) {
    nextScroll = Math.max(0, caretX - margin);
  }

  if (Math.abs(nextScroll - currentScroll) > 0.5) {
    input.scrollLeft = nextScroll;
  }
}
