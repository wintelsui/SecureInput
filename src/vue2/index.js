import SecureInput from "./SecureInputVue2.js";

SecureInput.install = function install(Vue) {
  Vue.component(SecureInput.name, SecureInput);
  Vue.component("secure-input", SecureInput);
};

export { SecureInput };
export default SecureInput;
