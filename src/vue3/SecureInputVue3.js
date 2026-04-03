import { defineComponent, h, nextTick, ref, watch } from "vue";
import { ensureInputCaretVisible } from "../core/caretScroll.js";
import { applyInputOperation, maskValue, normalizeValue } from "../core/secureInputCore.js";

/**
 * 读取受控值，优先使用 modelValue（Vue3 标准），其次回退到 value。
 *
 * @param {{modelValue?:string,value?:string}} props - 组件入参。
 * @returns {string|undefined} 当前外部受控值。
 */
function readControlledValue(props) {
  if (props.modelValue != null) {
    return props.modelValue;
  }
  return props.value;
}

export default defineComponent({
  name: "SecureInput",
  inheritAttrs: false,
  props: {
    /** Vue3 v-model 对应值。 */
    modelValue: {
      type: String,
      default: undefined,
    },
    /** 兼容 value 传值方式。 */
    value: {
      type: String,
      default: undefined,
    },
    /** 真实值最大长度限制。 */
    maxlength: {
      type: [Number, String],
      default: undefined,
    },
    /** 是否在右下角显示计数。 */
    displayNum: {
      type: Boolean,
      default: false,
    },
    /** 是否启用脱敏显示。 */
    encrypt: {
      type: Boolean,
      default: true,
    },
    /** 明文前缀显示长度。 */
    revealHead: {
      type: Number,
      default: 2,
    },
    /** 明文后缀显示长度。 */
    revealTail: {
      type: Number,
      default: 2,
    },
    /** 掩码字符，仅取首字符。 */
    maskChar: {
      type: String,
      default: "*",
    },
    /** 是否禁用输入。 */
    disabled: {
      type: Boolean,
      default: false,
    },
    /** 是否只读。 */
    readonly: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["update:modelValue", "input", "change", "focus", "blur"],
  setup(props, { attrs, emit, expose }) {
    const inputRef = ref(null);
    const internalValue = ref(normalizeValue(readControlledValue(props), props.maxlength));
    const pendingCaret = ref(null);
    const skipNextInput = ref(false);

    /**
     * 计算 input 中显示的脱敏文本。
     *
     * @returns {string} 显示文本。
     */
    function displayValue() {
      if (!props.encrypt) {
        return internalValue.value;
      }
      return maskValue(internalValue.value, {
        revealHead: props.revealHead,
        revealTail: props.revealTail,
        maskChar: props.maskChar,
      });
    }

    /**
     * 计算右下角计数文本。
     * 有 maxlength 时显示 `当前长度/最大长度`，否则显示 `当前长度`。
     *
     * @returns {string} 计数显示文本。
     */
    function displayCountText() {
      const currentLength = internalValue.value.length;
      const parsed = Number(props.maxlength);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return String(currentLength);
      }
      return `${currentLength}/${Math.floor(parsed)}`;
    }

    /**
     * 将显示值同步到原生 input。
     *
     * @returns {void}
     */
    function syncDomValue() {
      const input = inputRef.value;
      if (!input) {
        return;
      }
      const nextDisplay = displayValue();
      if (input.value !== nextDisplay) {
        input.value = nextDisplay;
      }
    }

    /**
     * 在视图更新后恢复光标位置。
     *
     * @returns {void}
     */
    function restoreCaret() {
      const input = inputRef.value;
      if (!input || pendingCaret.value == null) {
        return;
      }

      const caret = pendingCaret.value;
      pendingCaret.value = null;
      if (document.activeElement === input && typeof input.setSelectionRange === "function") {
        input.setSelectionRange(caret, caret);
        ensureInputCaretVisible(input, caret);
      }
    }

    /**
     * 向外触发值更新事件。
     *
     * @param {string} nextValue - 新值。
     * @returns {void}
     */
    function emitValue(nextValue) {
      emit("update:modelValue", nextValue);
      emit("input", nextValue);
    }

    /**
     * 提交新值并安排 DOM 同步和光标恢复。
     *
     * @param {string} nextValue - 新值。
     * @param {number|null|undefined} caret - 目标光标位置。
     * @returns {void}
     */
    function commitValue(nextValue, caret) {
      const normalized = normalizeValue(nextValue, props.maxlength);
      internalValue.value = normalized;
      pendingCaret.value =
        typeof caret === "number"
          ? Math.min(Math.max(0, caret), normalized.length)
          : null;
      emitValue(normalized);

      nextTick(() => {
        syncDomValue();
        restoreCaret();
      });
    }

    /**
     * 应用编辑操作结果。
     *
     * @param {{value:string,caret:number}|null} operation - 编辑结果。
     * @returns {void}
     */
    function applyOperation(operation) {
      if (!operation) {
        return;
      }
      skipNextInput.value = true;
      commitValue(operation.value, operation.caret);
    }

    /**
     * 处理 beforeinput：根据 inputType 精确控制插入/删除行为。
     *
     * @param {InputEvent} event - beforeinput 事件。
     * @returns {void}
     */
    function handleBeforeInput(event) {
      if (props.disabled || props.readonly) {
        return;
      }

      const input = inputRef.value;
      if (!input) {
        return;
      }

      const operation = applyInputOperation({
        currentValue: internalValue.value,
        inputType: event.inputType,
        data: event.data,
        selectionStart: input.selectionStart,
        selectionEnd: input.selectionEnd,
        maxLength: props.maxlength,
      });

      if (!operation) {
        return;
      }

      event.preventDefault();
      applyOperation(operation);
    }

    /**
     * 处理粘贴：仅保留数字和英文字母，再执行插入。
     *
     * @param {ClipboardEvent} event - 粘贴事件。
     * @returns {void}
     */
    function handlePaste(event) {
      if (props.disabled || props.readonly) {
        return;
      }

      const input = inputRef.value;
      if (!input) {
        return;
      }

      const text = event.clipboardData ? event.clipboardData.getData("text") : "";
      const operation = applyInputOperation({
        currentValue: internalValue.value,
        inputType: "insertFromPaste",
        data: text,
        selectionStart: input.selectionStart,
        selectionEnd: input.selectionEnd,
        maxLength: props.maxlength,
      });

      if (!operation) {
        return;
      }

      event.preventDefault();
      applyOperation(operation);
    }

    /**
     * 处理原生 input 事件。
     * 主要用于兼容某些浏览器在 preventDefault 后仍触发 input 的情况。
     *
     * @returns {void}
     */
    function handleInput() {
      if (skipNextInput.value) {
        skipNextInput.value = false;
        return;
      }

      // Older browsers may still trigger an input event after preventDefault.
      syncDomValue();
      restoreCaret();
    }

    /**
     * 失焦时透出 blur/change 事件。
     *
     * @param {FocusEvent} event - 失焦事件。
     * @returns {void}
     */
    function handleBlur(event) {
      emit("blur", event);
      emit("change", internalValue.value);
    }

    /**
     * 聚焦时透出 focus 事件。
     *
     * @param {FocusEvent} event - 聚焦事件。
     * @returns {void}
     */
    function handleFocus(event) {
      emit("focus", event);
    }

    /**
     * 当外部受控值变化时，同步到内部状态。
     *
     * @returns {void}
     */
    function syncFromProps() {
      const normalized = normalizeValue(readControlledValue(props), props.maxlength);
      if (normalized === internalValue.value) {
        return;
      }
      internalValue.value = normalized;
      nextTick(syncDomValue);
    }

    watch(() => props.modelValue, syncFromProps);
    watch(() => props.value, syncFromProps);
    watch(() => props.maxlength, syncFromProps);

    expose({
      /** 公开方法：聚焦输入框。 */
      focus() {
        inputRef.value?.focus();
      },
      /** 公开方法：让输入框失焦。 */
      blur() {
        inputRef.value?.blur();
      },
      /** 公开方法：选中输入框内容。 */
      select() {
        inputRef.value?.select();
      },
      /** 公开方法：获取真实值。 */
      getValue() {
        return internalValue.value;
      },
      /** 公开方法：设置真实值并同步显示。 */
      setValue(nextValue) {
        const normalized = normalizeValue(nextValue, props.maxlength);
        commitValue(normalized, normalized.length);
      },
    });

    return () => {
      const inputNode = h("input", {
        ...attrs,
        ref: inputRef,
        value: displayValue(),
        maxlength: props.maxlength,
        disabled: props.disabled,
        readonly: props.readonly,
        onBeforeinput: handleBeforeInput,
        onInput: handleInput,
        onPaste: handlePaste,
        onBlur: handleBlur,
        onFocus: handleFocus,
      });

      if (!props.displayNum) {
        return inputNode;
      }

      return h(
        "div",
        {
          style: {
            display: "block",
          },
        },
        [
          inputNode,
          h(
            "div",
            {
              style: {
                marginTop: "4px",
                fontSize: "12px",
                lineHeight: "1.2",
                color: "#909399",
                textAlign: "right",
                userSelect: "none",
              },
            },
            displayCountText()
          ),
        ]
      );
    };
  },
});
