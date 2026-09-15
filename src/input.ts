const MOVEMENT_KEYS = new Set(["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"]);

export const JOYSTICK_DEADZONE = 0.18;

export type MoveInput = {
  x: number;
  y: number;
  claw?: boolean;
  interact?: boolean;
};

export type PlayerInputSource = {
  sample(): MoveInput;
  dispose(): void;
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

function isInteract(event: KeyboardEvent) {
  return event.key.toLowerCase() === "e";
}

/** Screen-space stick offset to a game move vector. +x right, +y up. */
export function joystickFromOffset(
  dx: number,
  dy: number,
  radius: number,
  deadzone = JOYSTICK_DEADZONE,
): MoveInput {
  if (radius <= 0) return { x: 0, y: 0 };
  const x = dx / radius;
  const y = -dy / radius;
  const length = Math.hypot(x, y);
  if (length <= deadzone) return { x: 0, y: 0 };
  const magnitude = Math.min(1, (Math.min(1, length) - deadzone) / (1 - deadzone));
  return { x: (x / length) * magnitude, y: (y / length) * magnitude };
}

/** Combine keyboard and touch. Analog magnitudes below 1 stay analog; the sum is clamped. */
export function mergeInputs(a: MoveInput, b: MoveInput): MoveInput {
  let x = a.x + b.x;
  let y = a.y + b.y;
  const length = Math.hypot(x, y);
  if (length > 1) {
    x /= length;
    y /= length;
  }
  return {
    x,
    y,
    claw: Boolean(a.claw || b.claw),
    interact: Boolean(a.interact || b.interact),
  };
}

export function createPlayerInput(
  keyboard: PlayerInputSource,
  touch: PlayerInputSource,
): PlayerInputSource {
  return {
    sample() {
      return mergeInputs(keyboard.sample(), touch.sample());
    },
    dispose() {
      keyboard.dispose();
      touch.dispose();
    },
  };
}

export function createKeyboardInput(target: Window = window) {
  const keys = new Set<string>();
  let clawQueued = false;
  let interactQueued = false;

  const onKeyDown = (event: KeyboardEvent) => {
    if (isSpace(event)) {
      event.preventDefault();
      if (!event.repeat) clawQueued = true;
      return;
    }
    if (isInteract(event)) {
      event.preventDefault();
      if (!event.repeat) interactQueued = true;
      return;
    }
    const key = event.key.toLowerCase();
    if (MOVEMENT_KEYS.has(key)) event.preventDefault();
    keys.add(key);
  };
  const onKeyUp = (event: KeyboardEvent) => {
    if (isSpace(event) || isInteract(event)) return;
    keys.delete(event.key.toLowerCase());
  };
  const onBlur = () => {
    keys.clear();
    clawQueued = false;
    interactQueued = false;
  };

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("blur", onBlur);

  return {
    sample(): MoveInput {
      const move = moveFromKeys(keys);
      const claw = clawQueued;
      const interact = interactQueued;
      clawQueued = false;
      interactQueued = false;
      return { ...move, claw, interact };
    },
    dispose() {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
      target.removeEventListener("blur", onBlur);
      keys.clear();
      clawQueued = false;
      interactQueued = false;
    },
  };
}
