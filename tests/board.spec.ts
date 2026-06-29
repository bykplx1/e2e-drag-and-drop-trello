import { expect, test } from '@playwright/test';
import { BoardPage } from '../pages/BoardPage';

/**
 * BoardPage + create-board flow (issue #4).
 *
 * Each test creates its OWN board so isolation holds and the create-board flow
 * is exercised as a side effect of every spec. Assertions go through the
 * BoardPage state queries, never raw selectors — the spec reads as intent.
 */
test('creates a board and confirms it exists', async ({ page }) => {
  const boardPage = new BoardPage(page);
  const name = `Sprint Board ${Date.now()}`;

  await boardPage.createBoard(name);

  expect(await boardPage.currentBoardTitle()).toBe(name);
});

test('each test works on its own freshly created board', async ({ page }) => {
  const boardPage = new BoardPage(page);
  const name = `Backlog Board ${Date.now()}`;

  await boardPage.createBoard(name);

  // Isolation: this test asserts only against the board it created itself,
  // never a board left behind by another test.
  expect(await boardPage.currentBoardTitle()).toBe(name);
});
