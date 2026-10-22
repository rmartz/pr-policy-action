// Decides what one run evaluates, from the event that started it. A
// pull_request_target run evaluates the `pr` input. A `status` run carries a
// SHA, not a PR: when pr-lifecycle posts its `pr-lifecycle/sign-off` status,
// the runner re-evaluates every open PR at that head, so the verdict follows the
// new classification without waiting for the next push or label. Any other
// status is ignored, including the ones this Action posts itself. A
// `workflow_run` run, on the completion of the caller-named pr-lifecycle
// workflow, re-evaluates every open PR at that run's head the same way: a UAT
// label pr-lifecycle writes with GITHUB_TOKEN triggers no `labeled` run, so
// this is what re-runs the opt-in `require-uat-label` check once it lands.
//
// The event is read here rather than passed as an input, so a caller adds the
// trigger and nothing else, and the context filter lives in one place. See
// docs/consuming.md.

import { SIGN_OFF_STATUS_CONTEXT } from '@rmartz/pr-policy';

/**
 * What to evaluate: `{ pr }` for one PR, `{ sha }` for every open PR at that
 * head, or `{ skip }` with the reason there is nothing to do. `{ error }` means
 * the run can't tell which PR it is for.
 */
export function resolveTrigger({ eventName, event, pr }) {
  if (eventName === 'status') {
    if (event?.context !== SIGN_OFF_STATUS_CONTEXT) {
      return {
        skip: `ignoring status "${event?.context}" (only ${SIGN_OFF_STATUS_CONTEXT} re-runs)`,
      };
    }
    if (typeof event.sha !== 'string' || !/^[0-9a-f]{40}$/.test(event.sha)) {
      return { error: `the ${SIGN_OFF_STATUS_CONTEXT} status event has no commit SHA` };
    }
    return { sha: event.sha };
  }
  if (eventName === 'workflow_run') {
    // The caller's `workflows:` filter names pr-lifecycle's workflow; only its
    // completion matters, since that is when its labels have been written.
    if (event?.action !== 'completed') {
      return { skip: `ignoring workflow_run "${event?.action}" (only completed re-runs)` };
    }
    const sha = event.workflow_run?.head_sha;
    if (typeof sha !== 'string' || !/^[0-9a-f]{40}$/.test(sha)) {
      return { error: 'the workflow_run event has no head SHA' };
    }
    return { sha };
  }
  const number = Number(pr);
  if (!Number.isInteger(number) || number <= 0) {
    return { error: `need a PR number (got "${pr ?? ''}")` };
  }
  return { pr: number };
}
