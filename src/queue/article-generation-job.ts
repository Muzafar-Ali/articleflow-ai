import { z } from 'zod';

export const ARTICLE_GENERATION_QUEUE = 'article-generation';

export const GENERATE_ARTICLE_JOB = 'generate-article';

export const articleGenerationJobSchema = z.strictObject({
  jobId: z.uuid(),

  // Optional W3C trace context for future OpenTelemetry propagation.
  traceparent: z.string().min(1).optional(),
  tracestate: z.string().min(1).optional(),
});

export type ArticleGenerationJobData = z.infer<typeof articleGenerationJobSchema>;

export function parseArticleGenerationJob(input: unknown): ArticleGenerationJobData {
  return articleGenerationJobSchema.parse(input);
}
