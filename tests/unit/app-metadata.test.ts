import { describe, expect, it } from '@jest/globals';

import { APP_NAME, APP_VERSION } from '../../src/shared/app-metadata.js';

describe('application metadata', () => {
  it('exposes the ArticleFlow application name', () => {
    expect(APP_NAME).toBe('ArticleFlow AI');
  });

  it('exposes the current application version', () => {
    expect(APP_VERSION).toBe('1.0.0');
  });
});
