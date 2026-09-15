const MOVEMENT_KEYS = new Set(["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"]);

export type MoveInput = {
  x: number;
  y: number;
  claw?: boolean;
};

function isSpace(event: KeyboardEvent) {
  return event.key === " " || event.code === "Space";
}

/** Turn a held-key set into a unit-length move vector, or zero. */
export function moveFromKeys(keys: ReadonlySet<string>): MoveInput {
  let x = 0;
  let y = 0;
  if (keys.has("a") || keys.has("arrowleft")) x -= 1;
  if (keys.has("d") || keys.has("arrowright")) x += 1;
  if (keys.has("w") || keys.has("arrowup")) y += 1;
  if (keys.has("s") || keys.has("arrowdown")) y -= 1;
  if (!x && !y) return { x: 0, y: 0 };
  const length = Math.hypot(x, y);
  return { x: x / length, y: y / length };
}

export function createKeyboardInput(target: Window = window) {
  const keys = new Set<string>();
  let clawQueued = false;

  const onKeyDown = (event: KeyboardEvent) => {
    if (isSpace(event)) {
      event.preventDefault();
      if (!event.repeat) clawQueued = true;
      return;
    }
    const key = event.key.toLowerCase();
    if (MOVEMENT_KEYS.has(key)) event.preventDefault();
    keys.add(key);
  };
  const onKeyUp = (event: KeyboardEvent) => {
    if (isSpace(event)) return;
    keys.delete(event.key.toLowerCase());
  };
  const onBlur = () => {
    keys.clear();
    clawQueued = false;
  };

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("blur", onBlur);

  return {
    sample(): MoveInput {
      const move = moveFromKeys(keys);
      const claw = clawQueued;
      clawQueued = false;
      return { ...move, claw };
    },
    dispose() {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
      target.removeEventListener("blur", onBlur);
      keys.clear();
      clawQueued = false;
    },
  };
}
