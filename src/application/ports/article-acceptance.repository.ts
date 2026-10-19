export interface AcceptArticleCommand {
  readonly updateId: bigint;
  readonly telegramUserId: bigint;
  readonly chatId: bigint;
  readonly brief: string;
}

export interface AcceptedArticleRecord {
  readonly jobId: string;
  readonly updateId: bigint;
  readonly telegramUserId: bigint;
  readonly chatId: bigint;
}

export interface ArticleAcceptanceRepository {
  createAcceptedArticle(command: AcceptArticleCommand, idempotencyKey: string): Promise<string>;

  findByIdempotencyKey(idempotencyKey: string): Promise<AcceptedArticleRecord | null>;
}
