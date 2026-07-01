import { expect, test } from '@playwright/test';
import { BoardPage } from '../pages/BoardPage';

/**
 * DragHelper + move-card flow (issue #6).
 *
 * Uses BoardPage.moveCard which delegates to DragHelper.dragCardToColumn.
 * The drag is performed via synthetic HTML5 DragEvents sharing one DataTransfer
 * object — the only mechanic that works against react-dnd's HTML5 backend
 * (see docs/spike-findings.md §4). Engine-agnostic: verified on Chromium,
 * Firefox, and WebKit.
 *
 * Each test creates its own board for isolation.
 */
test('moving a card to another column: card appears in destination and is gone from source', async ({ page }) => {
  const boardPage = new BoardPage(page);
  await boardPage.createBoard(`Move Card ${Date.now()}`);

  // Set up: two columns, one card in column 0.
  await boardPage.addColumn();
  await boardPage.addCard(0, 'Drag Me');

  // Pre-condition.
  expect(await boardPage.cardTitlesInColumn(0)).toContain('Drag Me');
  expect(await boardPage.cardTitlesInColumn(1)).not.toContain('Drag Me');

  // Act — spec does not hand-roll the drag; BoardPage.moveCard delegates to DragHelper.
  await boardPage.moveCard('Drag Me', 0, 1);

  // Assert destination and source state.
  await expect(async () => {
    expect(await boardPage.cardTitlesInColumn(1)).toContain('Drag Me');
    expect(await boardPage.cardTitlesInColumn(0)).not.toContain('Drag Me');
  }).toPass();
});

test('moved card position persists after re-query', async ({ page }) => {
  const boardPage = new BoardPage(page);
  await boardPage.createBoard(`Move Card Persist ${Date.now()}`);

  await boardPage.addColumn();
  await boardPage.addCard(0, 'Persist Me');

  await boardPage.moveCard('Persist Me', 0, 1);

  // Re-query confirms the new position is stable — not a transient render.
  await expect(async () => {
    expect(await boardPage.cardTitlesInColumn(1)).toContain('Persist Me');
    expect(await boardPage.cardTitlesInColumn(0)).not.toContain('Persist Me');
  }).toPass();

  // Second re-query.
  expect(await boardPage.cardTitlesInColumn(1)).toContain('Persist Me');
  expect(await boardPage.cardTitlesInColumn(0)).not.toContain('Persist Me');
});
