import { ensureInputCaretVisible } from "../core/caretScroll.js";
import { applyInputOperation, maskValue, normalizeValue } from "../core/secureInputCore.js";

/**
 * 读取受控值，优先使用 modelValue，其次回退到 value。
 *
 * @param {{modelValue?:string,value?:string}} vm - 组件实例。
 * @returns {string|undefined} 当前外部受控值。
 */
function readControlledValue(vm) {
  if (vm.modelValue != null) {
    return vm.modelValue;
  }
  return vm.value;
}

export default {
  name: "SecureInput",
  inheritAttrs: false,
  props: {
    /** Vue3 风格的受控值字段（在 Vue2 中同样兼容）。 */
    modelValue: {
      type: String,
      default: undefined,
    },
    /** Vue2 经典 value 值。 */
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
  data() {
    return {
      internalValue: normalizeValue(readControlledValue(this), this.maxlength),
      pendingCaret: null,
      skipNextInput: false,
    };
  },
  computed: {
    /**
     * 计算输入框展示值（脱敏后）。
     *
     * @returns {string} 显示文本。
     */
    displayValue() {
      if (!this.encrypt) {
        return this.internalValue;
      }
      return maskValue(this.internalValue, {
        revealHead: this.revealHead,
        revealTail: this.revealTail,
        maskChar: this.maskChar,
      });
    },
    /**
     * 计算右下角计数字符串。
     * 有 maxlength 时显示 `当前长度/最大长度`。
     *
     * @returns {string} 计数文本。
     */
    displayCountText() {
      const currentLength = this.internalValue.length;
      const parsed = Number(this.maxlength);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return String(currentLength);
      }
      return `${currentLength}/${Math.floor(parsed)}`;
    },
  },
  watch: {
    value(nextValue) {
      this.syncFromProps(nextValue);
    },
    modelValue(nextValue) {
      this.syncFromProps(nextValue);
    },
    maxlength() {
      this.syncFromProps(readControlledValue(this));
    },
  },
  mounted() {
    this.syncDomValue();
  },
  methods: {
    /**
     * 当外部值变化时同步到内部状态。
     *
     * @param {string|undefined} nextValue - 外部新值。
     * @returns {void}
     */
    syncFromProps(nextValue) {
      const normalized = normalizeValue(nextValue, this.maxlength);
      if (normalized === this.internalValue) {
        return;
      }
      this.internalValue = normalized;
      this.$nextTick(this.syncDomValue);
    },
    /**
     * 将显示值写回原生 input，避免浏览器默认编辑结果与组件状态不一致。
     *
     * @returns {void}
     */
    syncDomValue() {
      const input = this.$refs.input;
      if (!input) {
        return;
      }
      if (input.value !== this.displayValue) {
        input.value = this.displayValue;
      }
    },
    /**
     * 在视图更新后恢复光标位置。
     *
     * @returns {void}
     */
    restoreCaret() {
      const input = this.$refs.input;
      if (!input || this.pendingCaret == null) {
        return;
      }

      const caret = this.pendingCaret;
      this.pendingCaret = null;
      if (document.activeElement === input && typeof input.setSelectionRange === "function") {
        input.setSelectionRange(caret, caret);
        ensureInputCaretVisible(input, caret);
      }
    },
    /**
     * 向外触发值更新事件。
     *
     * @param {string} nextValue - 新值。
     * @returns {void}
     */
    emitValue(nextValue) {
      this.$emit("update:modelValue", nextValue);
      this.$emit("input", nextValue);
    },
    /**
     * 提交新值，并在下一个 tick 同步 DOM 和光标。
     *
     * @param {string} nextValue - 新值。
     * @param {number|null|undefined} caret - 目标光标位置。
     * @returns {void}
     */
    commitValue(nextValue, caret) {
      const normalized = normalizeValue(nextValue, this.maxlength);
      this.internalValue = normalized;
      this.pendingCaret =
        typeof caret === "number"
          ? Math.min(Math.max(0, caret), normalized.length)
          : null;
      this.emitValue(normalized);
      this.$nextTick(() => {
        this.syncDomValue();
        this.restoreCaret();
      });
    },
    /**
     * 应用核心编辑结果。
     *
     * @param {{value:string,caret:number}|null} operation - 编辑结果。
     * @returns {void}
     */
    applyOperation(operation) {
      if (!operation) {
        return;
      }
      this.skipNextInput = true;
      this.commitValue(operation.value, operation.caret);
    },
    /**
     * 处理 beforeinput 事件，接管插入/删除逻辑。
     *
     * @param {InputEvent} event - beforeinput 事件。
     * @returns {void}
     */
    handleBeforeInput(event) {
      if (this.disabled || this.readonly) {
        return;
      }

      const input = this.$refs.input;
      if (!input) {
        return;
      }

      const operation = applyInputOperation({
        currentValue: this.internalValue,
        inputType: event.inputType,
        data: event.data,
        selectionStart: input.selectionStart,
        selectionEnd: input.selectionEnd,
        maxLength: this.maxlength,
      });

      if (!operation) {
        return;
      }

      event.preventDefault();
      this.applyOperation(operation);
    },
    /**
     * 处理粘贴，仅允许数字和英文字母进入真实值。
     *
     * @param {ClipboardEvent} event - 粘贴事件。
     * @returns {void}
     */
    handlePaste(event) {
      if (this.disabled || this.readonly) {
        return;
      }

      const input = this.$refs.input;
      if (!input) {
        return;
      }

      const text = event.clipboardData ? event.clipboardData.getData("text") : "";
      const operation = applyInputOperation({
        currentValue: this.internalValue,
        inputType: "insertFromPaste",
        data: text,
        selectionStart: input.selectionStart,
        selectionEnd: input.selectionEnd,
        maxLength: this.maxlength,
      });

      if (!operation) {
        return;
      }

      event.preventDefault();
      this.applyOperation(operation);
    },
    /**
     * 处理 input 事件，用于兼容部分浏览器事件顺序差异。
     *
     * @returns {void}
     */
    handleInput() {
      if (this.skipNextInput) {
        this.skipNextInput = false;
        return;
      }
      this.syncDomValue();
      this.restoreCaret();
    },
    /**
     * 对外透出 blur/change。
     *
     * @param {FocusEvent} event - 失焦事件。
     * @returns {void}
     */
    handleBlur(event) {
      this.$emit("blur", event);
      this.$emit("change", this.internalValue);
    },
    /**
     * 对外透出 focus。
     *
     * @param {FocusEvent} event - 聚焦事件。
     * @returns {void}
     */
    handleFocus(event) {
      this.$emit("focus", event);
    },
    /**
     * 公开方法：聚焦输入框。
     *
     * @returns {void}
     */
    focus() {
      this.$refs.input?.focus();
    },
    /**
     * 公开方法：让输入框失焦。
     *
     * @returns {void}
     */
    blur() {
      this.$refs.input?.blur();
    },
    /**
     * 公开方法：选中输入框内容。
     *
     * @returns {void}
     */
    select() {
      this.$refs.input?.select();
    },
    /**
     * 公开方法：获取真实值。
     *
     * @returns {string}
     */
    getValue() {
      return this.internalValue;
    },
    /**
     * 公开方法：设置真实值并同步显示状态。
     *
     * @param {string} nextValue - 外部传入的新值。
     * @returns {void}
     */
    setValue(nextValue) {
      const normalized = normalizeValue(nextValue, this.maxlength);
      this.commitValue(normalized, normalized.length);
    },
  },
  render(h) {
    const inputNode = h("input", {
      ref: "input",
      attrs: {
        ...this.$attrs,
        maxlength: this.maxlength,
        disabled: this.disabled,
        readonly: this.readonly,
      },
      domProps: {
        value: this.displayValue,
      },
      on: {
        ...this.$listeners,
        beforeinput: this.handleBeforeInput,
        input: this.handleInput,
        paste: this.handlePaste,
        blur: this.handleBlur,
        focus: this.handleFocus,
      },
    });

    if (!this.displayNum) {
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
          this.displayCountText
        ),
      ]
    );
  },
};
