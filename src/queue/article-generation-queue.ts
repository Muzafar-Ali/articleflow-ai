import { Queue } from 'bullmq';
import { createRedisConnection } from './redis-connection.ts';
import { ARTICLE_GENERATION_QUEUE } from './article-generation-job.js';

import type { ArticleGenerationJobData, GENERATE_ARTICLE_JOB } from './article-generation-job.js';

export function createArticleGenerationQueue(redisUrl: string) {
  const connection = createRedisConnection(redisUrl, 'dispatcher');

  const queue = new Queue<ArticleGenerationJobData, unknown, typeof GENERATE_ARTICLE_JOB>(
    ARTICLE_GENERATION_QUEUE,
    {
      connection,
      prefix: 'articleflow',
    },
  );

  return {
    queue,

    async close(): Promise<void> {
      try {
        await queue.close();
      } finally {
        connection.disconnect();
      }
    },
  };
}
