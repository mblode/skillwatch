import type { BuildOptions } from "rolldown";
import { defineConfig } from "tsdown";

type BuildOptionsWithCompatFields = BuildOptions & {
  define?: Record<string, string>;
  inject?: Record<string, string[] | string>;
};

const normalizeBuildOptions = (options: BuildOptions): void => {
  const buildOptions = options as BuildOptionsWithCompatFields;
  const { define, inject } = buildOptions;

  if (define === undefined && inject === undefined) {
    return;
  }

  const transform = {
    ...buildOptions.transform,
  };

  if (define !== undefined) {
    transform.define = {
      ...transform.define,
      ...define,
    };
    delete buildOptions.define;
  }

  if (inject !== undefined) {
    transform.inject = {
      ...transform.inject,
      ...inject,
    };
    delete buildOptions.inject;
  }

  buildOptions.transform = transform;
};

const shared = {
  banner: { js: "#!/usr/bin/env node" },
  format: ["esm"] as const,
  hooks: {
    "build:before": ({ buildOptions }: { buildOptions: BuildOptions }) => {
      normalizeBuildOptions(buildOptions);
    },
  },
  sourcemap: true,
  target: "node22" as const,
};

export default defineConfig([
  { ...shared, clean: true, entry: { cli: "src/cli.ts" } },
  { ...shared, clean: false, entry: { checker: "src/checker.ts" } },
]);
