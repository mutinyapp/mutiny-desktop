import { colorModes, type Scheme } from "./native-tokens";

/** Local CSS adapter; the upstream native-tokens.ts and manifest stay unchanged. */
export function nativeSurfaceCSS(appearance: Scheme): string {
  const variables = Object.entries(colorModes[appearance].normal)
    .map(([role, value]) => `--mutiny-${role.replaceAll(".", "-")}: ${value};`)
    .join("\n");
  return `:root { color-scheme: ${appearance};\n${variables}\n}`;
}
