import { createApp, defineComponent, h, ref } from "vue";
import SecureInput from "../../../src/vue3/SecureInputVue3.js";
import { maskValue } from "../../../src/core/secureInputCore.js";
import "./style.css";

const App = defineComponent({
  name: "ExampleApp",
  setup() {
    const secureText = ref("A1B2C3D4");

    return () =>
      h("main", { class: "page" }, [
        h("section", { class: "card" }, [
          h("h1", "SecureInput Vue3 示例"),
          h("p", { class: "hint" }, "只允许字母与数字，前后各显示 2 位，中间自动掩码。"),
          h("label", { class: "field-label", for: "secure-input" }, "证件号码"),
          h(SecureInput, {
            id: "secure-input",
            class: "input",
            modelValue: secureText.value,
            "onUpdate:modelValue": (nextValue) => {
              secureText.value = nextValue;
            },
            maxlength: 54,
            displayNum: true,
            placeholder: "请输入字母数字",
          }),
          h("div", { class: "preview" }, [
            h("div", [h("strong", "真实值："), secureText.value]),
            h("div", [h("strong", "显示值："), maskValue(secureText.value)]),
          ]),
        ]),
      ]);
  },
});

createApp(App).mount("#app");
