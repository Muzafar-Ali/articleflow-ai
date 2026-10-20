import { describe, expect, it } from '@jest/globals';
import {
  ARTICLE_GENERATION_QUEUE,
  GENERATE_ARTICLE_JOB,
  parseArticleGenerationJob,
} from '../../src/queue/article-generation-job.js';

const JOB_ID = '0197a0b4-58f1-7e3a-bd47-89c1a2b3c4d5';

describe('Article generation job contract', () => {
  it('uses stable queue and job names', () => {
    expect(ARTICLE_GENERATION_QUEUE).toBe('article-generation');
    expect(GENERATE_ARTICLE_JOB).toBe('generate-article');
  });

  it('accepts a valid job ID', () => {
    expect(parseArticleGenerationJob({ jobId: JOB_ID })).toEqual({
      jobId: JOB_ID,
    });
  });

  it('accepts optional trace context', () => {
    const input = {
      jobId: JOB_ID,
      traceparent: '00-0123456789abcdef0123456789abcdef-0123456789abcdef-01',
    };

    expect(parseArticleGenerationJob(input)).toEqual(input);
  });

  it('rejects an invalid job ID', () => {
    expect(() => parseArticleGenerationJob({ jobId: 'invalid-id' })).toThrow();
  });

  it('rejects a missing job ID', () => {
    expect(() => parseArticleGenerationJob({})).toThrow();
  });

  it('rejects unexpected payload fields', () => {
    expect(() =>
      parseArticleGenerationJob({
        jobId: JOB_ID,
        brief: 'This belongs in PostgreSQL',
      }),
    ).toThrow();
  });
});
