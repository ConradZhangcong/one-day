import type { Config } from "stylelint";

export default {
  extends: ["stylelint-config-standard"],
  rules: {
    // tailwindcss
    "at-rule-no-unknown": [
      true,
      {
        ignoreAtRules: [
          "tailwind",
          "apply",
          "variants",
          "responsive",
          "screen",
        ],
      },
    ],
  },
} satisfies Config;
