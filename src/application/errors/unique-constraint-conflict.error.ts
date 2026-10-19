export class UniqueConstraintConflictError extends Error {
  constructor() {
    super('Database uniqueness constraint conflict');

    this.name = 'UniqueConstraintConflictError';
  }
}
