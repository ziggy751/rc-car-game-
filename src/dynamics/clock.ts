export const FIXED_DT = 1 / 240;
/** Never tie physical time to rendered frames. Suspend time only after a >250 ms stall. */
export class FixedClock {
  accumulator = 0;
  droppedTime = 0;
  advance(frameDt: number, step: (dt: number) => void) {
    const elapsed = Math.max(0, Math.min(frameDt, 0.25));
    this.droppedTime += Math.max(0, frameDt - elapsed);
    this.accumulator += elapsed;
    while (this.accumulator + 1e-10 >= FIXED_DT) {
      step(FIXED_DT);
      this.accumulator -= FIXED_DT;
    }
    return Math.max(0, this.accumulator / FIXED_DT);
  }
  reset() {
    this.accumulator = 0;
  }
}
