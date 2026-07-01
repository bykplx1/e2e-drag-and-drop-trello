import { expect, test } from '@playwright/test';
import { BoardPage } from '../pages/BoardPage';

const MASKS_SHARED = [
  // Sidebar contains other boards with dynamic names and a user avatar
  '.Sidebar',
  // Any relative timestamps (e.g. "2 minutes ago") that change on reload
  '.time',
  '[data-testid="time"]',
];

test('empty-board snapshot', async ({ page }) => {
  const boardPage = new BoardPage(page);
  await boardPage.createBoard(`Visual Empty ${Date.now()}`);

  const masks = MASKS_SHARED.map((sel) => page.locator(sel));
  await expect(page).toHaveScreenshot('empty-board.png', {
    mask: masks,
    maxDiffPixelRatio: 0.02,
  });
});

test('populated-board snapshot', async ({ page }) => {
  const boardPage = new BoardPage(page);
  await boardPage.createBoard(`Visual Populated ${Date.now()}`);

  await boardPage.addColumn();
  await boardPage.addCard(0, 'Task Alpha');
  await boardPage.addCard(0, 'Task Beta');
  await boardPage.addCard(1, 'Task Gamma');

  const masks = MASKS_SHARED.map((sel) => page.locator(sel));
  await expect(page).toHaveScreenshot('populated-board.png', {
    mask: masks,
    maxDiffPixelRatio: 0.02,
  });
});
