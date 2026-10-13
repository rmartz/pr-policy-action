import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { decideTitle } from '@rmartz/pr-policy';

import { ciRetitle } from './retitle.mjs';

const DEPENDABOT = { login: 'dependabot[bot]', type: 'Bot' };

function manifest(devDependencies) {
  return JSON.stringify({ name: 'consumer', devDependencies });
}

function facts({ title, author = DEPENDABOT, from, to }) {
  return {
    title,
    author,
    labels: [],
    changedFiles: ['package.json'],
    workflowChanges: [],
    manifestChanges: [{ path: 'package.json', baseText: manifest(from), headText: manifest(to) }],
    signOffs: [],
  };
}

const blocks = (pr) => decideTitle(pr).findings.filter((finding) => finding.effect === 'block');

describe('a Dependabot PR bumping a CI-sensitive tool', () => {
  for (const tool of ['prettier', 'eslint']) {
    it(`retitles a ${tool} bump to ci and passes the title check`, () => {
      const pr = facts({
        title: `chore(deps-dev): bump ${tool} from 3.1.0 to 3.2.0`,
        from: { [tool]: '3.1.0' },
        to: { [tool]: '3.2.0' },
      });
      assert.ok(blocks(pr).length > 0, 'the original title should be blocked');

      const title = ciRetitle(pr);
      assert.equal(title, `ci(deps-dev): bump ${tool} from 3.1.0 to 3.2.0`);
      assert.deepEqual(blocks({ ...pr, title }), []);
    });
  }

  it('keeps a title without a scope', () => {
    const pr = facts({
      title: 'build: bump prettier from 3.1.0 to 3.2.0',
      from: { prettier: '3.1.0' },
      to: { prettier: '3.2.0' },
    });
    assert.equal(ciRetitle(pr), 'ci: bump prettier from 3.1.0 to 3.2.0');
  });

  it('leaves a title already typed ci alone', () => {
    const pr = facts({
      title: 'ci(deps-dev): bump prettier from 3.1.0 to 3.2.0',
      from: { prettier: '3.1.0' },
      to: { prettier: '3.2.0' },
    });
    assert.equal(ciRetitle(pr), undefined);
  });
});

describe('a Dependabot PR with no sensitive bump', () => {
  it('is left alone', () => {
    const pr = facts({
      title: 'chore(deps-dev): bump vitest from 3.1.0 to 3.2.0',
      from: { vitest: '3.1.0' },
      to: { vitest: '3.2.0' },
    });
    assert.equal(ciRetitle(pr), undefined);
  });
});

describe('a release-typed Dependabot PR with a sensitive bump', () => {
  for (const type of ['fix', 'feat', 'perf', 'revert']) {
    it(`leaves a ${type} title alone`, () => {
      const pr = facts({
        title: `${type}(deps): bump the production group with 2 updates`,
        from: { prettier: '3.1.0', lodash: '4.17.20' },
        to: { prettier: '3.2.0', lodash: '4.17.21' },
      });
      assert.equal(ciRetitle(pr), undefined);
    });
  }
});

describe('a PR not opened by Dependabot', () => {
  it('is never retitled', () => {
    const pr = facts({
      title: 'chore(deps-dev): bump prettier from 3.1.0 to 3.2.0',
      author: { login: 'octocat', type: 'User' },
      from: { prettier: '3.1.0' },
      to: { prettier: '3.2.0' },
    });
    assert.equal(ciRetitle(pr), undefined);
  });

  it('is never retitled when the author is unknown', () => {
    const pr = facts({
      title: 'chore(deps-dev): bump prettier from 3.1.0 to 3.2.0',
      from: { prettier: '3.1.0' },
      to: { prettier: '3.2.0' },
    });
    delete pr.author;
    assert.equal(ciRetitle(pr), undefined);
  });
});

describe('a title that is not a Conventional Commit', () => {
  it('is left alone', () => {
    const pr = facts({
      title: 'Bump prettier from 3.1.0 to 3.2.0',
      from: { prettier: '3.1.0' },
      to: { prettier: '3.2.0' },
    });
    assert.equal(ciRetitle(pr), undefined);
  });
});
