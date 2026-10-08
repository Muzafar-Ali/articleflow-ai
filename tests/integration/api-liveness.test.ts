import { describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { createApp } from '../../src/api/app.js';

describe('GET /health/live', () => {
  it('returns HTTP 200 with the service identity', async () => {
    const response = await request(createApp()).get('/health/live');

    expect(response.status).toBe(200);
    expect(response.text).toContain('"status":"ok"');
    expect(response.text).toContain('"service":"articleflow-api"');
  });

  it('does not expose the Express framework header', async () => {
    const response = await request(createApp()).get('/health/live');

    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});
