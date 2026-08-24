import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import typescriptEslint from "typescript-eslint";

/**
 * Single root flat config for the whole monorepo.
 * - Shared packages: strict TS rules.
 * - Web app (apps/web): Next.js core-web-vitals + React hooks rules.
 */
const eslintConfig = [
  ...typescriptEslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "off",
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx,mts,mjs}"],
    plugins: {
      "@next/next": nextPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      ...nextPlugin.configs["core-web-vitals"].rules,
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.vercel/**",
      "**/.eve/**",
      "**/.data/**",
      "**/.turbo/**",
      "**/.venv/**",
      "**/__pycache__/**",
      "**/.pytest_cache/**",
      "**/.medusa/**",
      "packages/contracts/dist/**",
      "**/out/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "**/next-env.d.ts",
    ],
  },
];

export default eslintConfig;
