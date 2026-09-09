import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // PR32's signing harness executes POSIX shebang tools via file symlinks.
    // Run it canonically on macOS; Windows cannot execute that harness.
    exclude: [
      ...configDefaults.exclude,
      ...(process.platform === "win32" ? ["tests/macosSigningContract.test.mjs"] : []),
    ],
  },
});
