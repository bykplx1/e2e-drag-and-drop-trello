import { expect, test } from '@playwright/test';
import { BoardPage } from '../pages/BoardPage';
import { DragHelper } from '../pages/DragHelper';

/**
 * DragHelper isolation test (issue #7).
 *
 * Calls DragHelper.dragCardToColumn DIRECTLY — not via BoardPage.moveCard —
 * to prove that the synthetic HTML5 DragEvent mechanic is engine-agnostic
 * and decoupled from any BoardPage abstraction.
 *
 * Runs under chromium, firefox, and webkit automatically (all three projects
 * depend on the `setup` project and pick up this spec from testDir).
 */
test('DragHelper.dragCardToColumn moves card to destination and removes it from source', async ({ page }) => {
  const boardPage = new BoardPage(page);
  await boardPage.createBoard(`DnD Isolation ${Date.now()}`);

  // Two columns, one card in column 0.
  await boardPage.addColumn();
  await boardPage.addCard(0, 'Isolated Card');

  // Pre-condition.
  expect(await boardPage.cardTitlesInColumn(0)).toContain('Isolated Card');
  expect(await boardPage.cardTitlesInColumn(1)).not.toContain('Isolated Card');

  // Resolve locators for the card and destination column directly — bypassing
  // BoardPage.moveCard entirely so this test exercises DragHelper in isolation.
  const boardContainer = page.locator('.BoardComponent');
  const sourceColumn = boardContainer.locator('.octo-board-column').nth(0);
  const destColumn = boardContainer.locator('.octo-board-column').nth(1);
  const card = sourceColumn
    .locator('.KanbanCard')
    .filter({ has: page.locator('.octo-titletext', { hasText: 'Isolated Card' }) })
    .first();

  // Act — DragHelper called directly, not via BoardPage.moveCard.
  const dragHelper = new DragHelper(page);
  await dragHelper.dragCardToColumn(card, destColumn);

  // Assert: card present in destination, absent from source.
  await expect(async () => {
    expect(await boardPage.cardTitlesInColumn(1)).toContain('Isolated Card');
    expect(await boardPage.cardTitlesInColumn(0)).not.toContain('Isolated Card');
  }).toPass();
});
