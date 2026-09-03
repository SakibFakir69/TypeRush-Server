import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      globals: globals.node, // server project — not browser
    },
  },
  tseslint.configs.recommendedTypeChecked, // stricter than 'recommended' — needs type info
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // Correctness — these catch real bugs
      "@typescript-eslint/no-floating-promises": "error", // unhandled async errors
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn", // don't hard-block, but flag
      "@typescript-eslint/consistent-type-imports": "error",

      // Safety
      eqeqeq: ["error", "always"],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      "no-var": "error",
      "no-return-await": "off", // superseded by no-floating-promises
      "@typescript-eslint/return-await": ["error", "in-try-catch"],
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "build/**", "coverage/**"],
  },
]);