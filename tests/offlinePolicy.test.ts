import { describe, expect, it } from "vitest";
import { offlineErrorClass, retryDelay, shouldShowOffline } from "../src/native/offlinePolicy";
describe("offline failure policy", () => {
  it.each([-2, -105, -106, -107, -200, -324])("shows main frame error %s", code => expect(shouldShowOffline(code, true)).toBe(true));
  it.each([-3, 0])("ignores cancellation/success %s", code => expect(shouldShowOffline(code, true)).toBe(false));
  it.each([-2, -105, -106, -200])("ignores subframe failure %s", code => expect(shouldShowOffline(code, false)).toBe(false));
  it.each([[-106,"offline"],[-105,"dns"],[-137,"dns"],[-107,"tls"],[-200,"tls"],[-202,"tls"],[-299,"tls"],[-2,"server"],[-324,"server"]] as const)("classifies %s as %s", (code, label) => expect(offlineErrorClass(code)).toBe(label));
  it.each([[0,5000],[1,15000],[2,30000],[3,60000],[4,60000],[100,60000]])("backoff attempt %s is %s ms", (attempt, delay) => expect(retryDelay(attempt)).toBe(delay));
});
