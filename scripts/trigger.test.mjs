import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveTrigger } from './trigger.mjs';

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

for (const eventName of ['status', 'workflow_run']) {
  describe(`a leftover ${eventName} run`, () => {
    it('is skipped with a warning naming the trigger to remove', () => {
      const result = resolveTrigger({ eventName, pr: '' });
      assert.ok(result.skip);
      assert.match(result.warning, new RegExp(`Remove the ${eventName} trigger`));
      assert.equal(result.pr, undefined);
      assert.equal(result.error, undefined);
    });

    it('ignores the pr input', () => {
      assert.equal(resolveTrigger({ eventName, pr: '7' }).pr, undefined);
    });
  });
}
