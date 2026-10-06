import { type JSONSchema } from "json-schema-typed";

export type NativeAppearance = "dark" | "light";

export const configSchema = {
  appearance: { type: "string", enum: ["dark", "light"] } as JSONSchema.String,
  firstLaunch: { type: "boolean" } as JSONSchema.Boolean,
  customFrame: { type: "boolean" } as JSONSchema.Boolean,
  minimiseToTray: { type: "boolean" } as JSONSchema.Boolean,
  startMinimisedToTray: { type: "boolean" } as JSONSchema.Boolean,
  spellchecker: { type: "boolean" } as JSONSchema.Boolean,
  hardwareAcceleration: { type: "boolean" } as JSONSchema.Boolean,
  discordRpc: { type: "boolean" } as JSONSchema.Boolean,
  windowState: {
    type: "object",
    properties: {
      isMaximised: { type: "boolean" } as JSONSchema.Boolean,
    },
  } as JSONSchema.Object,
};

export const configDefaults: DesktopConfig & { appearance: NativeAppearance } = {
  appearance: "dark",
  firstLaunch: true,
  customFrame: true,
  minimiseToTray: true,
  startMinimisedToTray: false,
  spellchecker: true,
  hardwareAcceleration: true,
  discordRpc: true,
  windowState: { isMaximised: false },
};
