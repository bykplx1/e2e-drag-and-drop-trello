import { expect, type Locator, type Page } from '@playwright/test';
import { DragHelper } from './DragHelper';

/**
 * Page object for a Focalboard board (issue #4).
 *
 * Encapsulates the create-board flow and the state queries specs assert
 * against, so specs read as intent (`createBoard`, `currentBoardTitle`) rather
 * than raw selectors. Selectors are locked to docs/spike-findings.md.
 */
export class BoardPage {
  private readonly page: Page;

  /** Sidebar "+ Add board" affordance — the verified create-board entry point. */
  private readonly addBoard: Locator;

  /** "Create an empty board" button in the template-picker dialog. */
  private readonly createEmptyBoard: Locator;

  /** The board view container; present once a board is open and ready. */
  private readonly boardContainer: Locator;

  /** The board's editable title input on the board view. */
  private readonly boardTitle: Locator;

  /** The Kanban columns (groups) rendered on the board. */
  private readonly columns: Locator;

  /** "+ Add a group" affordance that appends a new column. */
  private readonly addGroup: Locator;

  /** The open card dialog, shown after a card is created via "+ New". */
  private readonly cardDialog: Locator;

  /** Editable card-title field inside the card dialog. */
  private readonly cardDialogTitle: Locator;

  /** Close button on the card dialog. */
  private readonly cardDialogClose: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addBoard = page.locator('.add-board');
    this.createEmptyBoard = page.getByRole('button', { name: 'Create an empty board' });
    this.boardContainer = page.locator('.BoardComponent');
    // The open board's title input, scoped to the board view. Other boards'
    // titles also render in the DOM (e.g. the seeded "Meeting Agenda"), so
    // scoping to .BoardComponent keeps this unambiguous.
    this.boardTitle = page.locator('.BoardComponent').getByPlaceholder('Untitled board');
    // Scope columns to the open board view so queries never pick up a
    // different board's columns lingering in the DOM during navigation.
    this.columns = this.boardContainer.locator('.octo-board-column');
    // Focalboard renders two "+ Add a group" affordances (one per board view
    // region); the first is the visible one in the Kanban body.
    this.addGroup = page.getByRole('button', { name: '+ Add a group' }).first();
    this.cardDialog = page.locator('.cardDialog');
    this.cardDialogTitle = page.locator('textarea.EditableArea.title');
    this.cardDialogClose = page.locator('.cardDialog .dialog__close');
  }

  /** The column (group) at the 0-based `index` on the open board. */
  private columnAt(index: number): Locator {
    return this.columns.nth(index);
  }

  /**
   * Creates a fresh empty board through the UI and names it.
   *
   * Drives the sidebar affordance -> "Create an empty board", waits for the
   * board view to be ready, then sets the board title to `name`.
   */
  async createBoard(name: string): Promise<void> {
    await this.page.goto('/');

    // The sidebar affordance opens an animated template-picker dialog. Two
    // races make this flaky under parallel load: the affordance click can land
    // before the sidebar is interactive (a no-op), and the dialog button
    // animates in (visible-but-unstable, so a click detaches mid-transition).
    // Retry the whole open -> create sequence until the board view appears,
    // which is the only reliable success signal.
    await this.addBoard.waitFor({ state: 'visible' });
    await expect(async () => {
      await this.addBoard.click();
      await this.createEmptyBoard.click({ timeout: 2000 });
      await expect(this.boardContainer).toBeVisible({ timeout: 2000 });
    }).toPass();

    // Name the board, retrying the fill until the value sticks. The board view
    // can still be reconciling right after creation (the title input briefly
    // shows a previous board under parallel load against the shared user), so a
    // single fill can race the swap; retry until our name is confirmed.
    await expect(this.boardTitle).toBeVisible();
    await expect(async () => {
      await this.boardTitle.fill(name);
      await this.boardTitle.blur();
      await expect(this.boardTitle).toHaveValue(name, { timeout: 2000 });
    }).toPass();

    // Confirm the default column has rendered before returning, so callers
    // observe the finished board state.
    await expect(this.columns).not.toHaveCount(0);
  }

  /** The current board's title — used to assert a named board exists. */
  async currentBoardTitle(): Promise<string> {
    return this.boardTitle.inputValue();
  }

  /** Number of columns (groups) currently rendered on the board. */
  async columnCount(): Promise<number> {
    return this.columns.count();
  }

  /** Adds a new column (group) to the board via the "+ Add a group" affordance. */
  async addColumn(): Promise<void> {
    // Wait for the affordance to be ready so the board has finished rendering
    // before we read the baseline count; reading mid-reconciliation would catch
    // a transient column count and make the post-add assertion race.
    await this.addGroup.waitFor({ state: 'visible' });
    const before = await this.columns.count();
    await this.addGroup.click();
    // Wait for the new column to render so the flow is deterministic under
    // parallel load and callers observe the post-add state.
    await expect(this.columns).toHaveCount(before + 1);
  }

  /**
   * Adds a card titled `title` to the column at `columnIndex` (0-based).
   *
   * Drives the column's "+ New" affordance, names the card in the card dialog,
   * and closes it, leaving the card rendered on the board.
   */
  async addCard(columnIndex: number, title: string): Promise<void> {
    const column = this.columnAt(columnIndex);
    const cardsBefore = await column.locator('.octo-titletext').count();

    await column.getByRole('button', { name: '+ New' }).click();

    // The card dialog opens; name the card, then close it.
    await this.cardDialogTitle.waitFor({ state: 'visible' });
    await this.cardDialogTitle.fill(title);
    await this.cardDialogClose.click();
    await this.cardDialog.waitFor({ state: 'hidden' });

    // Confirm the card landed in the column before returning, so cards added
    // back-to-back render deterministically in insertion order.
    await expect(column.locator('.octo-titletext')).toHaveCount(cardsBefore + 1);
    await expect(column.getByText(title, { exact: true })).toBeVisible();
  }

  /** Ordered titles of the cards rendered in the column at `columnIndex`. */
  async cardTitlesInColumn(columnIndex: number): Promise<string[]> {
    return this.columnAt(columnIndex).locator('.octo-titletext').allInnerTexts();
  }

  /**
   * Moves the card titled `cardTitle` from `sourceColumnIndex` to
   * `destColumnIndex` (both 0-based) using DragHelper's synthetic HTML5
   * DragEvent sequence — the only mechanism that works against react-dnd's
   * HTML5 backend (see docs/spike-findings.md §4).
   */
  async moveCard(cardTitle: string, sourceColumnIndex: number, destColumnIndex: number): Promise<void> {
    const sourceColumn = this.columnAt(sourceColumnIndex);
    const destColumn = this.columnAt(destColumnIndex);
    const card = sourceColumn.locator('.KanbanCard').filter({ has: this.page.locator('.octo-titletext', { hasText: cardTitle }) }).first();

    const dragHelper = new DragHelper(this.page);
    await dragHelper.dragCardToColumn(card, destColumn);
  }
}
