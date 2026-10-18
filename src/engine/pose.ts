export class PoseCycle {
  private currentFrame = 0;
  private elapsed = 0;
  private restDuration: number;
  private phase: 'rest' | 'pose' = 'rest';
  private engaged = false;
  private wasEngaged = false;

  constructor(private readonly random = Math.random) {
    this.restDuration = this.nextRest();
  }

  get frame() {
    return this.currentFrame;
  }

  setEngaged(engaged: boolean) {
    if (engaged && !this.engaged) this.wasEngaged = true;
    this.engaged = engaged;
    if (engaged) {
      this.currentFrame = 1;
      this.elapsed = 0;
    }
  }

  update(dt: number) {
    if (this.engaged) return this.currentFrame = 1;
    if (this.wasEngaged) {
      this.wasEngaged = false;
      this.currentFrame = 0;
      this.phase = 'rest';
      this.elapsed = 0;
      this.restDuration = this.nextRest();
      return this.currentFrame;
    }

    this.elapsed += Math.max(0, dt);
    if (this.phase === 'rest' && this.elapsed >= this.restDuration) {
      this.elapsed -= this.restDuration;
      this.phase = 'pose';
      this.currentFrame = 1;
    }
    if (this.phase === 'pose' && this.elapsed >= 1000) {
      this.elapsed -= 1000;
      this.phase = 'rest';
      this.currentFrame = 0;
      this.restDuration = this.nextRest();
    }
    return this.currentFrame;
  }

  private nextRest() {
    return 2500 + Math.max(0, Math.min(1, this.random())) * 1500;
  }
}
