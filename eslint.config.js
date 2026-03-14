import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["dist/**"],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error",
    },
  },
];
