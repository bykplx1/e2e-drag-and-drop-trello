import { expect, type Locator, type Page } from '@playwright/test';

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

  /** The board view container; present once a board is open and ready. */
  private readonly boardContainer: Locator;

  /** The board's editable title input on the board view. */
  private readonly boardTitle: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addBoard = page.locator('.add-board');
    this.boardContainer = page.locator('.BoardComponent');
    this.boardTitle = page.getByPlaceholder('Untitled board');
  }

  /**
   * Creates a fresh empty board through the UI and names it.
   *
   * Drives the sidebar affordance -> "Create an empty board", waits for the
   * board view to be ready, then sets the board title to `name`.
   */
  async createBoard(name: string): Promise<void> {
    await this.page.goto('/');
    await this.addBoard.click();

    // The sidebar affordance opens a menu; wait for the create item to render
    // before clicking so the flow is deterministic under parallel load.
    const createEmpty = this.page.getByText('Create an empty board');
    await createEmpty.waitFor({ state: 'visible' });
    await createEmpty.click();

    await expect(this.boardContainer).toBeVisible();

    await this.boardTitle.fill(name);
    await this.boardTitle.blur();
  }

  /** The current board's title — used to assert a named board exists. */
  async currentBoardTitle(): Promise<string> {
    return this.boardTitle.inputValue();
  }
}
