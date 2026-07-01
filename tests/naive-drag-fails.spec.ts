import { expect, test } from '@playwright/test';
import { BoardPage } from '../pages/BoardPage';

/**
 * Naive drag demonstration (issue #7).
 *
 * WHY THIS TEST EXISTS AND MUST NOT BE DELETED:
 *   Focalboard cards use react-dnd's HTML5 backend, which listens exclusively
 *   to synthetic HTML5 DragEvents — NOT to pointer/mouse events synthesized by
 *   Playwright's native drag APIs. As a result, `locator.dragTo()` and
 *   `page.dragAndDrop()` time out or silently no-op on every engine (see
 *   docs/spike-findings.md §4, the headline finding). This test reproduces that
 *   failure deterministically and asserts the card did NOT move, proving two
 *   things:
 *     1. The suite validates STATE, not absence of exception — a timed-out drag
 *        that doesn't throw is still caught here.
 *     2. The naive path genuinely fails, which justifies DragHelper's synthetic-
 *        event approach. Removing this test would silently lose that justification.
 *
 *   Keep this test green (card-did-not-move assertion passing). Do not delete it.
 */
test('naive locator.dragTo() does NOT move the card on this HTML5-backend target', async ({ page }) => {
  const boardPage = new BoardPage(page);
  await boardPage.createBoard(`Naive Drag ${Date.now()}`);

  // Two columns, one card in column 0.
  await boardPage.addColumn();
  await boardPage.addCard(0, 'Naive Card');

  // Pre-condition.
  expect(await boardPage.cardTitlesInColumn(0)).toContain('Naive Card');
  expect(await boardPage.cardTitlesInColumn(1)).not.toContain('Naive Card');

  // Attempt the naive drag. Give it a short timeout so the test does not hang
  // in CI when dragTo times out waiting for a drop that react-dnd never fires.
  // We catch both timeout errors and any other drag-related errors — the point
  // is what the board state is AFTER the attempt, not whether an error is thrown.
  const boardContainer = page.locator('.BoardComponent');
  const sourceColumn = boardContainer.locator('.octo-board-column').nth(0);
  const destColumn = boardContainer.locator('.octo-board-column').nth(1);
  const card = sourceColumn
    .locator('.KanbanCard')
    .filter({ has: page.locator('.octo-titletext', { hasText: 'Naive Card' }) })
    .first();

  try {
    // Short timeout: dragTo will hang indefinitely on this target if left uncapped.
    await card.dragTo(destColumn, { timeout: 3000 });
  } catch {
    // Expected: dragTo times out or throws on react-dnd's HTML5-backend target.
    // The meaningful assertion is below — the card must NOT have moved.
  }

  // Assert: card still in source column; did NOT reach the destination.
  // This is the core finding — the naive approach fails silently/by timeout,
  // and the board state confirms it. DragHelper's synthetic-event approach is
  // the only mechanism that actually moves cards on this target.
  expect(await boardPage.cardTitlesInColumn(0)).toContain('Naive Card');
  expect(await boardPage.cardTitlesInColumn(1)).not.toContain('Naive Card');
});
