import { AxeBuilder } from '@axe-core/playwright';
import { Page } from '@playwright/test';

/**
 * a11yScan — scoped axe-core accessibility scan helper.
 *
 * Wraps AxeBuilder with the project's standard tag set (wcag2a, wcag2aa,
 * wcag21a, wcag21aa) and an optional CSS selector to scope the scan.
 *
 * Chosen clean view (issue #9, spike-findings.md §5):
 *   The login page's <form> scoped via `.include('form')` yields ZERO
 *   violations under the tag set above. Rationale: the login form is a
 *   genuinely self-contained view we can honestly assert strict-zero against.
 *   The board view carries Focalboard's own a11y debt (nested-interactive,
 *   button-name, color-contrast, meta-viewport) which is out of scope to fix;
 *   we audit, we do not patch Focalboard.
 */
export async function a11yScan(page: Page, include?: string) {
  let builder = new AxeBuilder({ page }).withTags([
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
  ]);

  if (include) {
    builder = builder.include(include);
  }

  return builder.analyze();
}
