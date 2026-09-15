/** Deck bounds in local XY for a pier of the given world size. */
export function pierDeckBounds(width: number, height: number) {
  return {
    minX: (4 / 42 - 0.5) * width,
    maxX: (38 / 42 - 0.5) * width,
    minY: (0.5 - 63 / 68) * height,
    maxY: (0.5 - 3 / 68) * height,
  };
}

/** Positive inset keeps a character's feet inside the deck edges. */
export function pierContainsLocalPoint(
  width: number,
  height: number,
  localX: number,
  localY: number,
  inset = 0,
) {
  const deck = pierDeckBounds(width, height);
  return localX >= deck.minX + inset
    && localX <= deck.maxX - inset
    && localY >= deck.minY + inset
    && localY <= deck.maxY - inset;
}
