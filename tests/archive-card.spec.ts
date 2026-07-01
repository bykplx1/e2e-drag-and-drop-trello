import { expect, test } from '@playwright/test';
import { BoardPage } from '../pages/BoardPage';

/**
 * CardModal + archive-card flow (issue #8).
 *
 * Creates a board, adds a column and a card, archives the card via
 * BoardPage.archiveCard (which delegates to CardModal), then asserts the
 * card's title is no longer visible in the active board view.
 */
test('archiving a card removes it from the active board view', async ({ page }) => {
  const boardPage = new BoardPage(page);
  await boardPage.createBoard(`Archive Card ${Date.now()}`);

  await boardPage.addColumn();
  await boardPage.addCard(0, 'Card to Archive');

  // Confirm the card is present before archiving.
  const board = page.locator('.BoardComponent');
  await expect(board.getByText('Card to Archive', { exact: true })).toBeVisible();

  await boardPage.archiveCard('Card to Archive');

  // The card's title text must no longer be rendered anywhere in the board.
  await expect(board.locator('.octo-titletext', { hasText: 'Card to Archive' })).toHaveCount(0);
});
