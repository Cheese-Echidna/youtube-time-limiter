const {
    defineConfig,
    globalIgnores,
} = require("eslint/config");

const globals = require("globals");
const js = require("@eslint/js");

const {
    FlatCompat,
} = require("@eslint/eslintrc");

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

module.exports = defineConfig([{
    languageOptions: {
        globals: {
            ...globals.browser,
            ...globals.webextensions,
        },

        ecmaVersion: "latest",
        sourceType: "module",
        parserOptions: {},
    },

    extends: compat.extends("eslint:recommended", "plugin:prettier/recommended"),

    rules: {
        "no-unused-vars": ["warn", {
            args: "none",
            ignoreRestSiblings: true,
        }],

        "no-undef": "off",
    },
}, globalIgnores(["**/node_modules/", "production/web-ext-artifacts/"])]);