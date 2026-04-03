const ALLOWED_CHAR_PATTERN = /[0-9A-Za-z]/;
const INSERT_INPUT_TYPES = new Set([
  "insertText",
  "insertReplacementText",
  "insertFromPaste",
  "insertFromDrop",
  "insertCompositionText",
]);

/**
 * 将 maxlength 归一化为可计算的有限长度。
 * 非法值或负数会视为无限制。
 *
 * @param {number|string|undefined|null} maxLength - 外部传入的 maxlength。
 * @returns {number} 有效长度，或 Infinity。
 */
function toFiniteLength(maxLength) {
  const parsed = Number(maxLength);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.floor(parsed);
}

/**
 * 规范化选区，保证 start/end 在 [0, textLength] 内且 start <= end。
 *
 * @param {number|null|undefined} selectionStart - 选区起始位置。
 * @param {number|null|undefined} selectionEnd - 选区结束位置。
 * @param {number} textLength - 当前文本长度。
 * @returns {{start:number,end:number}} 规范化后的选区。
 */
function clampSelection(selectionStart, selectionEnd, textLength) {
  const max = Math.max(0, textLength);
  const start = Number.isFinite(selectionStart)
    ? Math.min(Math.max(0, selectionStart), max)
    : max;
  const end = Number.isFinite(selectionEnd)
    ? Math.min(Math.max(0, selectionEnd), max)
    : start;

  if (start <= end) {
    return { start, end };
  }
  return { start: end, end: start };
}

/**
 * 根据最大长度限制可插入文本长度。
 *
 * @param {string} text - 待插入文本。
 * @param {number} prefixLength - 插入点前长度。
 * @param {number} suffixLength - 插入点后长度。
 * @param {number} maxLength - 最大允许长度。
 * @returns {string} 截断后的可插入文本。
 */
function capInsert(text, prefixLength, suffixLength, maxLength) {
  if (!Number.isFinite(maxLength)) {
    return text;
  }
  const available = Math.max(0, maxLength - prefixLength - suffixLength);
  return text.slice(0, available);
}

/**
 * 在指定选区执行插入并返回新值和光标位置。
 *
 * @param {string} currentValue - 当前真实值。
 * @param {number} start - 选区起始。
 * @param {number} end - 选区结束。
 * @param {string} nextData - 将要插入的文本。
 * @param {number} maxLength - 最大允许长度。
 * @returns {{value:string,caret:number}} 编辑结果。
 */
function insertValue(currentValue, start, end, nextData, maxLength) {
  const before = currentValue.slice(0, start);
  const after = currentValue.slice(end);
  const inserted = capInsert(nextData, before.length, after.length, maxLength);
  const value = `${before}${inserted}${after}`;

  return {
    value,
    caret: before.length + inserted.length,
  };
}

/**
 * 过滤输入，仅保留数字和英文字母。
 *
 * @param {unknown} input - 原始输入。
 * @returns {string} 过滤后的字符串。
 */
export function sanitizeInput(input) {
  if (input == null) {
    return "";
  }

  return Array.from(String(input))
    .filter((char) => ALLOWED_CHAR_PATTERN.test(char))
    .join("");
}

/**
 * 对输入值执行字符过滤并应用最大长度限制。
 *
 * @param {unknown} value - 原始值。
 * @param {number|string|undefined|null} maxLength - 最大长度。
 * @returns {string} 归一化后的值。
 */
export function normalizeValue(value, maxLength) {
  const cleaned = sanitizeInput(value);
  const max = toFiniteLength(maxLength);
  if (!Number.isFinite(max)) {
    return cleaned;
  }
  return cleaned.slice(0, max);
}

/**
 * 将真实值转换为脱敏显示值。
 * 默认展示前 2 位和后 2 位，中间使用 maskChar。
 *
 * @param {unknown} value - 真实值。
 * @param {{revealHead?:number,revealTail?:number,maskChar?:string}} [options] - 掩码配置。
 * @returns {string} 脱敏后的显示文本。
 */
export function maskValue(value, options = {}) {
  const text = value == null ? "" : String(value);
  const revealHead = Math.max(0, Number(options.revealHead ?? 2) || 0);
  const revealTail = Math.max(0, Number(options.revealTail ?? 2) || 0);
  const maskChar = String(options.maskChar || "*").charAt(0) || "*";

  if (text.length <= revealHead + revealTail) {
    return text;
  }

  const middleSize = text.length - revealHead - revealTail;
  return `${text.slice(0, revealHead)}${maskChar.repeat(middleSize)}${text.slice(
    text.length - revealTail
  )}`;
}

/**
 * 根据 beforeinput/inputType 计算一次编辑操作结果。
 * 支持插入、粘贴、前删、后删、范围删除等行为。
 *
 * @param {{
 *   currentValue: unknown,
 *   inputType: string,
 *   data?: string|null,
 *   selectionStart?: number|null,
 *   selectionEnd?: number|null,
 *   maxLength?: number|string|null
 * }} options - 编辑上下文。
 * @returns {{value:string,caret:number}|null} 可处理时返回结果，否则返回 null。
 */
export function applyInputOperation(options) {
  const {
    currentValue,
    inputType,
    data,
    selectionStart,
    selectionEnd,
    maxLength,
  } = options;

  const max = toFiniteLength(maxLength);
  const value = normalizeValue(currentValue, max);
  const selection = clampSelection(selectionStart, selectionEnd, value.length);

  if (INSERT_INPUT_TYPES.has(inputType)) {
    const inserted = sanitizeInput(data || "");
    return insertValue(value, selection.start, selection.end, inserted, max);
  }

  if (inputType === "deleteByCut" || inputType === "deleteByDrag") {
    if (selection.start === selection.end) {
      return { value, caret: selection.start };
    }
    return {
      value: `${value.slice(0, selection.start)}${value.slice(selection.end)}`,
      caret: selection.start,
    };
  }

  if (
    inputType === "deleteContentBackward" ||
    inputType === "deleteWordBackward" ||
    inputType === "deleteSoftLineBackward" ||
    inputType === "deleteHardLineBackward"
  ) {
    if (selection.start !== selection.end) {
      return {
        value: `${value.slice(0, selection.start)}${value.slice(selection.end)}`,
        caret: selection.start,
      };
    }
    if (selection.start === 0) {
      return { value, caret: 0 };
    }

    const removeIndex = selection.start - 1;
    return {
      value: `${value.slice(0, removeIndex)}${value.slice(selection.start)}`,
      caret: removeIndex,
    };
  }

  if (
    inputType === "deleteContentForward" ||
    inputType === "deleteWordForward" ||
    inputType === "deleteSoftLineForward" ||
    inputType === "deleteHardLineForward"
  ) {
    if (selection.start !== selection.end) {
      return {
        value: `${value.slice(0, selection.start)}${value.slice(selection.end)}`,
        caret: selection.start,
      };
    }
    if (selection.start === value.length) {
      return { value, caret: value.length };
    }
    return {
      value: `${value.slice(0, selection.start)}${value.slice(selection.start + 1)}`,
      caret: selection.start,
    };
  }

  return null;
}
