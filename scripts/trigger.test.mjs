import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveTrigger } from './trigger.mjs';

const SHA = 'a'.repeat(40);

describe('a pull_request_target run', () => {
  it('evaluates the pr input', () => {
    assert.deepEqual(resolveTrigger({ eventName: 'pull_request_target', pr: '12' }), { pr: 12 });
  });

  for (const pr of ['', undefined, '0', '-3', '1.5', 'abc']) {
    it(`fails on a pr input of ${JSON.stringify(pr)}`, () => {
      assert.ok(resolveTrigger({ eventName: 'pull_request_target', pr }).error);
    });
  }
});

describe('a status run', () => {
  it('evaluates the open PRs at the sign-off status SHA', () => {
    const event = { context: 'pr-lifecycle/sign-off', sha: SHA, state: 'success' };
    assert.deepEqual(resolveTrigger({ eventName: 'status', event, pr: '' }), { sha: SHA });
  });

  it('ignores the pr input', () => {
    const event = { context: 'pr-lifecycle/sign-off', sha: SHA };
    assert.deepEqual(resolveTrigger({ eventName: 'status', event, pr: '7' }), { sha: SHA });
  });

  for (const context of ['pr-policy', 'pr-policy / uat', 'ci/build', undefined]) {
    it(`skips a ${JSON.stringify(context)} status`, () => {
      const result = resolveTrigger({ eventName: 'status', event: { context, sha: SHA } });
      assert.ok(result.skip);
      assert.equal(result.sha, undefined);
    });
  }

  it('fails on a sign-off status with no SHA', () => {
    const event = { context: 'pr-lifecycle/sign-off' };
    assert.ok(resolveTrigger({ eventName: 'status', event }).error);
  });
});
