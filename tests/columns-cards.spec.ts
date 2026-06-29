import { expect, test } from '@playwright/test';
import { BoardPage } from '../pages/BoardPage';

/**
 * BoardPage + add-column / add-card flow (issue #5).
 *
 * Each test creates its OWN board first for isolation, then exercises the
 * column/card flows. Assertions go through BoardPage state queries and check
 * observable board state (column count, rendered card titles in order), never
 * page-object internals. Counts are asserted as deltas off a freshly-created
 * board so the specs hold whatever baseline groups Focalboard seeds.
 */
test('adding a column renders an additional column on the board', async ({ page }) => {
  const boardPage = new BoardPage(page);
  await boardPage.createBoard(`Add Column ${Date.now()}`);

  const before = await boardPage.columnCount();
  await boardPage.addColumn();

  expect(await boardPage.columnCount()).toBe(before + 1);
});

test('adding cards to a column renders them in the order added', async ({ page }) => {
  const boardPage = new BoardPage(page);
  await boardPage.createBoard(`Add Cards ${Date.now()}`);

  await boardPage.addCard(0, 'Write spec');
  await boardPage.addCard(0, 'Implement feature');
  await boardPage.addCard(0, 'Ship it');

  expect(await boardPage.cardTitlesInColumn(0)).toEqual([
    'Write spec',
    'Implement feature',
    'Ship it',
  ]);
});
