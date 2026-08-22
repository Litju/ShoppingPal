import type { Linter } from "eslint";

import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig: Linter.Config[] = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      ".data/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
      "db/migrations.ts",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "off",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];

export default eslintConfig;
