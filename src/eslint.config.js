import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
    {
        ignores: ["node_modules/**", "build/**", ".extension-build/**"],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    prettier,
    {
        files: ["**/*.ts"],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.webextensions,
            },
        },
    },
);
