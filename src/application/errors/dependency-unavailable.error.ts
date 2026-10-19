export class DependencyUnavailableError extends Error {
  constructor(
    public readonly dependency: 'postgresql',
    options?: ErrorOptions,
  ) {
    super('Required dependency temporarily unavailable', options);

    this.name = 'DependencyUnavailableError';
  }
}
