// Decides what one run evaluates, from the event that started it: the `pr`
// input, as passed by a pull_request_target caller.
//
// Before v2 a caller also ran the Action on `status` (pr-lifecycle's
// `pr-lifecycle/sign-off`) and on `workflow_run` (pr-lifecycle's workflow).
// @rmartz/pr-policy 3 dropped that dependency, so a run from either trigger has
// nothing to do. It is skipped with a warning naming the trigger to remove,
// rather than failed, so a caller that hasn't been updated yet doesn't go red on
// every status posted to the repo. See docs/consuming.md#upgrading-to-v2.

const RETIRED_TRIGGERS = ['status', 'workflow_run'];

/**
 * What to evaluate: `{ pr }` for one PR, or `{ skip, warning }` with the reason
 * there is nothing to do. `{ error }` means the run can't tell which PR it is
 * for.
 */
export function resolveTrigger({ eventName, pr }) {
  if (RETIRED_TRIGGERS.includes(eventName)) {
    return {
      skip: `ignoring a ${eventName} run`,
      warning:
        `pr-policy no longer re-runs on ${eventName} events. ` +
        `Remove the ${eventName} trigger from this caller workflow (see the Upgrading section of the pr-policy-action README).`,
    };
  }
  const number = Number(pr);
  if (!Number.isInteger(number) || number <= 0) {
    return { error: `need a PR number (got "${pr ?? ''}")` };
  }
  return { pr: number };
}
