export const ENDING_LINES = [
  "You saved Mosswhiskers Meadow.",
  "For now...",
  "Watch the woods. And your own pond, while you still have one.",
] as const;

export const ENDING_PROMPT = "Press Space to return to game";

export const ENDING_TIMING = {
  fadeBlack: 1.2,
  lineIn: 0.8,
  lineHold: [2.2, 1.6, 1.8] as const,
  lineOut: 0.55,
  promptIn: 0.7,
  fadeOut: 1,
};

export type EndingView = {
  visible: boolean;
  overlay: number;
  line: string;
  lineOpacity: number;
  promptOpacity: number;
  blocking: boolean;
  canDismiss: boolean;
};

type Phase =
  | "idle"
  | "fade-black"
  | "line-in"
  | "line-hold"
  | "line-out"
  | "prompt-in"
  | "wait"
  | "fade-out";

function ease(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

const IDLE_VIEW: EndingView = {
  visible: false,
  overlay: 0,
  line: "",
  lineOpacity: 0,
  promptOpacity: 0,
  blocking: false,
  canDismiss: false,
};

export function shouldStartEnding(onVictoryTalk: boolean, wasVictoryTalk: boolean, played: boolean) {
  return wasVictoryTalk && !onVictoryTalk && !played;
}

export function createEndingSequence() {
  let phase: Phase = "idle";
  let elapsed = 0;
  let lineIndex = 0;

  function durationOf(current: Phase) {
    if (current === "idle" || current === "wait") return null;
    if (current === "fade-black") return ENDING_TIMING.fadeBlack;
    if (current === "line-in") return ENDING_TIMING.lineIn;
    if (current === "line-hold") return ENDING_TIMING.lineHold[lineIndex]!;
    if (current === "line-out") return ENDING_TIMING.lineOut;
    if (current === "prompt-in") return ENDING_TIMING.promptIn;
    return ENDING_TIMING.fadeOut;
  }

  function advance() {
    if (phase === "fade-black") phase = "line-in";
    else if (phase === "line-in") phase = "line-hold";
    else if (phase === "line-hold") phase = lineIndex >= ENDING_LINES.length - 1 ? "prompt-in" : "line-out";
    else if (phase === "line-out") {
      lineIndex += 1;
      phase = "line-in";
    } else if (phase === "prompt-in") phase = "wait";
    else if (phase === "fade-out") {
      phase = "idle";
      lineIndex = 0;
    }
  }

  return {
    start() {
      phase = "fade-black";
      elapsed = 0;
      lineIndex = 0;
    },
    tryDismiss() {
      if (phase !== "wait") return false;
      phase = "fade-out";
      elapsed = 0;
      return true;
    },
    tick(dt: number) {
      if (phase === "idle" || phase === "wait") return;
      elapsed += dt;
      while (phase !== "idle" && phase !== "wait") {
        const duration = durationOf(phase);
        if (duration == null || elapsed < duration) break;
        elapsed -= duration;
        advance();
      }
      if (phase === "idle") elapsed = 0;
    },
    view(): EndingView {
      if (phase === "idle") return IDLE_VIEW;
      const line = ENDING_LINES[Math.min(lineIndex, ENDING_LINES.length - 1)]!;
      const fade = durationOf(phase) ?? 1;
      const u = ease(elapsed / fade);
      let overlay = 1;
      let lineOpacity = 0;
      let promptOpacity = 0;
      if (phase === "fade-black") overlay = u;
      else if (phase === "fade-out") overlay = 1 - u;
      if (phase === "line-in") lineOpacity = u;
      else if (phase === "line-hold" || phase === "prompt-in" || phase === "wait" || phase === "fade-out") lineOpacity = 1;
      else if (phase === "line-out") lineOpacity = 1 - u;
      if (phase === "prompt-in") promptOpacity = u;
      else if (phase === "wait" || phase === "fade-out") promptOpacity = 1;
      return {
        visible: true,
        overlay,
        line,
        lineOpacity: phase === "fade-black" ? 0 : lineOpacity,
        promptOpacity,
        blocking: true,
        canDismiss: phase === "wait",
      };
    },
    blocking() {
      return phase !== "idle";
    },
  };
}
