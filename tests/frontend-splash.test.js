import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { importFresh, installBrowserEnv } from './helpers/browser-env.js';

describe('frontend splash module', () => {
  beforeEach(() => {
    installBrowserEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('hides the loading splash when there is no access token', async () => {
    document.getElementById('loadingSplash').style.display = 'block';

    await importFresh('../public/js/splash.js');

    expect(document.getElementById('loadingSplash').style.display).toBe('none');
  });

  it('keeps the loading splash visible when an access token exists', async () => {
    localStorage.setItem('sb-access-token', 'user-access');
    document.getElementById('loadingSplash').style.display = 'block';

    await importFresh('../public/js/splash.js');

    expect(document.getElementById('loadingSplash').style.display).toBe('block');
  });
});
