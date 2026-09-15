import { expect, test } from "bun:test";
import { interactPromptCopy, shouldShowInteractPrompt } from "./mail-hud";

test("desktop hints keep the E key", () => {
  expect(interactPromptCopy("mailbox", false, false)).toBe("E · READ MAIL");
  expect(interactPromptCopy("intake", true, false)).toBe("Press E to insert carrot");
  expect(interactPromptCopy("bernie", false, false)).toBe("E · TALK");
});

test("mobile hints use USE and skip the TALK toast", () => {
  expect(interactPromptCopy("mailbox", false, true)).toBe("USE · READ MAIL");
  expect(interactPromptCopy("intake", true, true)).toBe("USE · INSERT CARROT");
  expect(interactPromptCopy("intake", false, true)).toBe("USE");
  expect(shouldShowInteractPrompt("bernie", null, "TALK", true)).toBe(false);
  expect(shouldShowInteractPrompt("mailbox", null, "USE · READ MAIL", true)).toBe(true);
  expect(shouldShowInteractPrompt("bernie", null, "E · TALK", false)).toBe(true);
});
