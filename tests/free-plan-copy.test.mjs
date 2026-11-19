import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('Free plan landing and signup copy avoid permanent promises and state current allowance', async () => {
  const landing = await read('../landing/public/index.html');
  const signup = await read('../app/app/signup/page.tsx');
  for (const page of [landing, signup]) assert.doesNotMatch(page, /forever|lifetime/i);
  assert.match(landing, /Free daily practice/);
  assert.match(landing, /5 min AI conversation \/ day/);
  assert.match(signup, /5 minutes of AI conversation per day on the Free plan/);
  assert.match(signup, /No credit card required\./);
});

test('advertised Free allowance still matches Terms and tier configuration', async () => {
  const terms = await read('../app/app/(marketing)/terms/page.tsx');
  const tier = await read('../app/lib/subscription/tier.ts');
  assert.match(terms, /Free Plan:<\/strong> Limited to 5 minutes of AI conversation per day/);
  assert.match(tier, /free:\s*\{\s*conversation:\s*\{\s*dailyLimitSec:\s*300\s*\}/);
});
