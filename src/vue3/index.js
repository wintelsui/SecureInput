import SecureInput from "./SecureInputVue3.js";

export { SecureInput };
export default {
  install(app) {
    app.component(SecureInput.name, SecureInput);
  },
};
