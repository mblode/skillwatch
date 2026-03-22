import { readFileSync } from "node:fs";

import type { BuildOptions } from "rolldown";
import { defineConfig } from "tsdown";

interface PackageManifest {
  name: string;
  version: string;
}

type BuildOptionsWithCompatFields = BuildOptions & {
  define?: Record<string, string>;
  inject?: Record<string, string[] | string>;
};

const packageJson = JSON.parse(
  readFileSync(new URL("package.json", import.meta.url), "utf8")
) as PackageManifest;

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
  define: {
    __SKILLWATCH_PACKAGE_NAME__: JSON.stringify(packageJson.name),
    __SKILLWATCH_PACKAGE_VERSION__: JSON.stringify(packageJson.version),
  },
  format: ["esm"] as const,
  hooks: {
    "build:before": ({ buildOptions }: { buildOptions: BuildOptions }) => {
      normalizeBuildOptions(buildOptions);
      buildOptions.output = {
        ...buildOptions.output,
        banner: "#!/usr/bin/env node",
      };
    },
  },
  sourcemap: false,
  target: "node22" as const,
};

export default defineConfig({
  ...shared,
  clean: true,
  entry: { checker: "src/checker.ts", cli: "src/cli.ts" },
});
