import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...tseslint.configs.recommended,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Custom ignores:
    "node_modules/**",
    "coverage/**",
    "lib/**",
    "src/components/ui/**",
    "scripts/**",
    // Config files
    "*.config.mjs",
    "*.config.js",
    "*.config.ts",
  ]),
  // Custom rules from eslint-config-connect
  {
    rules: {
      // Semicolons
      "semi": ["warn", "always"],
      "semi-style": ["warn", "last"],
      "no-extra-semi": "warn",

      // Variables & Constants
      "no-const-assign": "warn",
      "prefer-const": "warn",
      "no-var": "warn",

      // Equality & Conditions
      "eqeqeq": "warn",
      "no-constant-condition": "warn",
      "use-isnan": "warn",

      // Functions
      "require-await": "warn",
      "func-call-spacing": ["warn", "never"],

      // Spacing
      "space-before-blocks": ["warn", "always"],
      "no-multi-spaces": "warn",
      "block-spacing": "warn",
      "arrow-spacing": "warn",
      "computed-property-spacing": ["warn", "never"],
      "no-trailing-spaces": "warn",
      "indent": ["warn", 4, { SwitchCase: 1 }],

      // Template literals
      "no-template-curly-in-string": "warn",
      "prefer-template": "warn",

      // Duplicates & Imports
      "no-dupe-args": "warn",
      "no-dupe-keys": "warn",
      "no-duplicate-imports": "warn",
      "no-dupe-class-members": "warn",

      // Control flow
      "no-fallthrough": "warn",
      "no-unreachable": "warn",
      "no-unsafe-optional-chaining": "warn",
      "no-unused-expressions": "warn",
      "curly": "warn",
      "no-else-return": ["warn", { allowElseIf: false }],
      "no-lonely-if": "warn",

      // TypeScript specific
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",

      // Quotes & Commas
      "quotes": ["warn", "single", { avoidEscape: true }],
      "comma-dangle": ["warn", "never"],
      "comma-spacing": ["warn", { before: false, after: true }],
      "comma-style": ["warn", "last"],

      // Empty lines
      "no-multiple-empty-lines": ["warn", { max: 1, maxEOF: 0 }],
    },
  },
]);

export default eslintConfig;
