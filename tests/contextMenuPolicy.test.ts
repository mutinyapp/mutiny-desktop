import { describe, expect, it, vi } from "vitest";

import {
  type ContextMenuEntry,
  type ContextMenuPolicyParams,
  buildContextMenuPlan,
  buildContextMenuTemplate,
  isCopyableLink,
} from "../src/native/contextMenuPolicy";

const noFlags = {
  canUndo: false,
  canRedo: false,
  canCut: false,
  canCopy: false,
  canPaste: false,
  canSelectAll: false,
};

function params(
  over: Partial<ContextMenuPolicyParams> = {},
): ContextMenuPolicyParams {
  return {
    x: 10,
    y: 20,
    isEditable: false,
    selectionText: "",
    linkURL: "",
    srcURL: "",
    mediaType: "none",
    misspelledWord: "",
    dictionarySuggestions: [],
    ...over,
    editFlags: { ...noFlags, ...(over.editFlags ?? {}) },
  };
}

const labels = (plan: ContextMenuEntry[]) =>
  plan.map((e) => (e.type === "separator" ? "---" : e.label));

function expectWellFormedSeparators(plan: ContextMenuEntry[]) {
  expect(plan[0]?.type).not.toBe("separator");
  expect(plan[plan.length - 1]?.type).not.toBe("separator");
  plan.forEach((e, i) => {
    if (e.type === "separator") expect(plan[i + 1]?.type).not.toBe("separator");
  });
}

function roleEnabled(plan: ContextMenuEntry[], role: string) {
  const entry = plan.find((e) => e.type === "role" && e.role === role);
  return entry && entry.type === "role" ? entry.enabled : undefined;
}

describe("context menu policy", () => {
  it("editable empty field: edit items present, paste enabled, cut/copy disabled", () => {
    const plan = buildContextMenuPlan(
      params({
        isEditable: true,
        editFlags: { ...noFlags, canPaste: true, canSelectAll: true },
      }),
    );
    expect(labels(plan)).toEqual([
      "Undo",
      "Redo",
      "---",
      "Cut",
      "Copy",
      "Paste",
      "Paste as plain text",
      "---",
      "Select All",
      "---",
      "Toggle spellcheck",
    ]);
    expect(roleEnabled(plan, "cut")).toBe(false);
    expect(roleEnabled(plan, "copy")).toBe(false);
    expect(roleEnabled(plan, "paste")).toBe(true);
    expect(roleEnabled(plan, "undo")).toBe(false);
    expectWellFormedSeparators(plan);
  });

  it("editable with selection: cut and copy enabled", () => {
    const plan = buildContextMenuPlan(
      params({
        isEditable: true,
        selectionText: "hello",
        editFlags: {
          ...noFlags,
          canCut: true,
          canCopy: true,
          canPaste: true,
          canSelectAll: true,
          canUndo: true,
        },
      }),
    );
    expect(roleEnabled(plan, "cut")).toBe(true);
    expect(roleEnabled(plan, "copy")).toBe(true);
    expect(roleEnabled(plan, "paste")).toBe(true);
    expect(roleEnabled(plan, "selectAll")).toBe(true);
    expect(roleEnabled(plan, "undo")).toBe(true);
    expectWellFormedSeparators(plan);
  });

  it("plain (read-only) text selection: only Copy, no spellcheck toggle", () => {
    const plan = buildContextMenuPlan(
      params({
        selectionText: "a chat message",
        editFlags: { ...noFlags, canCopy: true },
      }),
    );
    expect(labels(plan)).toEqual(["Copy"]);
    expect(roleEnabled(plan, "copy")).toBe(true);
  });

  it("link: Copy Link with the http(s) URL; non-http links are ignored", () => {
    const plan = buildContextMenuPlan(
      params({ linkURL: "https://example.com/a" }),
    );
    expect(plan).toEqual([
      {
        type: "action",
        label: "Copy Link",
        action: { kind: "copyLink", url: "https://example.com/a" },
      },
    ]);
    expect(
      buildContextMenuPlan(params({ linkURL: "javascript:alert(1)" })),
    ).toEqual([]);
    expect(
      buildContextMenuPlan(params({ linkURL: "file:///etc/passwd" })),
    ).toEqual([]);
    expect(isCopyableLink("http://x.test")).toBe(true);
    expect(isCopyableLink("not a url")).toBe(false);
  });

  it("image: Copy Image at the click coordinates; selection + link combine cleanly", () => {
    const plan = buildContextMenuPlan(
      params({
        mediaType: "image",
        srcURL: "https://cdn.test/i.png",
        x: 5,
        y: 7,
      }),
    );
    expect(plan).toEqual([
      {
        type: "action",
        label: "Copy Image",
        action: { kind: "copyImage", x: 5, y: 7 },
      },
    ]);
    const combined = buildContextMenuPlan(
      params({
        selectionText: "t",
        linkURL: "https://l.test",
        mediaType: "image",
        srcURL: "https://cdn.test/i.png",
        editFlags: { ...noFlags, canCopy: true },
      }),
    );
    expect(labels(combined)).toEqual([
      "Copy",
      "---",
      "Copy Link",
      "Copy Image",
    ]);
    expect(
      buildContextMenuPlan(params({ mediaType: "image", srcURL: "" })),
    ).toEqual([]);
  });

  it("misspelled word: suggestions and Add to dictionary come first", () => {
    const plan = buildContextMenuPlan(
      params({
        isEditable: true,
        selectionText: "helo",
        misspelledWord: "helo",
        dictionarySuggestions: ["hello", "help"],
        editFlags: {
          ...noFlags,
          canCut: true,
          canCopy: true,
          canPaste: true,
          canSelectAll: true,
        },
      }),
    );
    expect(labels(plan).slice(0, 4)).toEqual([
      "hello",
      "help",
      "Add to dictionary",
      "---",
    ]);
    expect(plan[0]).toEqual({
      type: "action",
      label: "hello",
      action: { kind: "replaceMisspelling", suggestion: "hello" },
    });
    expect(plan[2]).toMatchObject({
      action: { kind: "addToDictionary", word: "helo" },
    });
    expect(labels(plan)).toContain("Paste");
    expect(labels(plan)[labels(plan).length - 1]).toBe("Toggle spellcheck");
    expectWellFormedSeparators(plan);
  });

  it("nothing to show: empty plan and empty template", () => {
    expect(buildContextMenuPlan(params())).toEqual([]);
    expect(buildContextMenuPlan(params({ selectionText: "   " }))).toEqual([]);
    expect(buildContextMenuTemplate(params(), () => undefined)).toEqual([]);
  });

  it("never offers inspect/navigation items", () => {
    const plan = buildContextMenuPlan(
      params({
        isEditable: true,
        selectionText: "x",
        linkURL: "https://l.test",
        mediaType: "image",
        srcURL: "https://i.test",
        misspelledWord: "x",
        dictionarySuggestions: ["y"],
      }),
    );
    for (const label of labels(plan)) {
      expect(label).not.toMatch(/inspect|open|back|forward|reload|search/i);
    }
  });

  it("template uses Electron roles and routes custom actions to the runner", () => {
    const run = vi.fn();
    const template = buildContextMenuTemplate(
      params({
        isEditable: true,
        linkURL: "https://l.test",
        editFlags: { ...noFlags, canPaste: true },
      }),
      run,
    );
    expect(template.find((t) => t.role === "paste")).toMatchObject({
      enabled: true,
      label: "Paste",
    });
    expect(template.find((t) => t.role === "cut")).toMatchObject({
      enabled: false,
    });
    expect(
      template.filter((t) => t.type === "separator").length,
    ).toBeGreaterThan(0);
    const copyLink = template.find((t) => t.label === "Copy Link");
    (copyLink?.click as () => void)();
    expect(run).toHaveBeenCalledWith({
      kind: "copyLink",
      url: "https://l.test",
    });
  });
});
