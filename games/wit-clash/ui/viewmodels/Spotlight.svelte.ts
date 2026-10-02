export class Spotlight {
  current = $state(0);
  private readonly timer: ReturnType<typeof setInterval>;

  constructor(
    private readonly count: () => number,
    periodMs = 8000,
  ) {
    this.timer = setInterval(() => this.advance(), periodMs);
  }

  get isActive(): boolean {
    return this.count() > 1;
  }

  destroy(): void {
    clearInterval(this.timer);
  }

  private advance(): void {
    this.current = this.isActive ? (this.current + 1) % this.count() : 0;
  }
}
