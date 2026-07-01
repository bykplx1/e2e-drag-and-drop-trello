import { type Locator, type Page } from '@playwright/test';

/**
 * Page object for card-level actions (issue #8).
 *
 * Encapsulates opening a card's detail dialog and performing destructive
 * removal ("archive") via the card's actions menu (⋯). The ⋯ icon is only
 * rendered on card hover, so this class hovers the card before clicking it.
 * Selectors are locked to docs/spike-findings.md §3.
 */
export class CardModal {
  private readonly page: Page;

  /** The card dialog overlay shown when a card is opened. */
  private readonly dialog: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.locator('.Dialog.cardDialog');
  }

  /**
   * Opens the card detail dialog for the card with `cardTitle` found anywhere
   * inside `scope` (typically `.BoardComponent`).
   */
  async open(scope: Locator, cardTitle: string): Promise<void> {
    const card = scope
      .locator('.KanbanCard')
      .filter({ has: this.page.locator('.octo-titletext', { hasText: cardTitle }) })
      .first();

    await card.waitFor({ state: 'visible' });
    await card.click();
    await this.dialog.waitFor({ state: 'visible' });
  }

  /**
   * Closes the card detail dialog.
   */
  async close(): Promise<void> {
    await this.dialog.locator('.dialog__close').click();
    await this.dialog.waitFor({ state: 'hidden' });
  }

  /**
   * Removes the card from the board by using the ⋯ actions menu on the card.
   *
   * "Archive" in the issue maps to Focalboard's destructive "Delete" action
   * (spike-findings.md §6, §3): hover the `.KanbanCard` to reveal
   * `.CardActionsMenuIcon`, click it, then click the "Delete" menu item.
   * If a confirmation dialog appears it is accepted automatically.
   *
   * The dialog is closed (if still open) before interacting with the card so
   * the board view is visible.
   */
  async archiveFromBoard(scope: Locator, cardTitle: string): Promise<void> {
    // Ensure no dialog is covering the board.
    if (await this.dialog.isVisible()) {
      await this.close();
    }

    const card = scope
      .locator('.KanbanCard')
      .filter({ has: this.page.locator('.octo-titletext', { hasText: cardTitle }) })
      .first();

    await card.waitFor({ state: 'visible' });
    // Hover to reveal the actions menu icon (only rendered on hover).
    await card.hover();

    const menuIcon = card.locator('.CardActionsMenuIcon');
    await menuIcon.waitFor({ state: 'visible' });
    await menuIcon.click();

    // The menu renders in the page (not inside the card element); find the
    // "Delete" item. Focalboard 7.11.4 uses "Delete" as its removal label.
    const deleteItem = this.page.getByRole('button', { name: 'Delete' });
    await deleteItem.waitFor({ state: 'visible' });
    await deleteItem.click();

    // Focalboard may show a confirmation dialog — accept it if present.
    const confirmButton = this.page.getByRole('button', { name: 'Delete' });
    try {
      await confirmButton.waitFor({ state: 'visible', timeout: 1500 });
      await confirmButton.click();
    } catch {
      // No confirmation dialog — deletion completed immediately.
    }
  }
}
