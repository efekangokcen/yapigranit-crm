import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Üretilen (generated) kod — elle yazılmadığı için lint edilmemeli.
    "src/generated/**",
    // Yerel git worktree'leri (repo içinde iç içe checkout'lar) — kaynak değil.
    ".claude/**",
  ]),
  {
    // scripts/*.js: bağımsız Node CommonJS araçları, uygulama bundle'ının parçası değil.
    files: ["scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
