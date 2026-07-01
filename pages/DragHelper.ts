import { type Locator, type Page } from '@playwright/test';

/**
 * DragHelper — synthetic HTML5 DragEvent-based drag for react-dnd's HTML5
 * backend (issue #6).
 *
 * Background (docs/spike-findings.md §4):
 *   - Playwright `dragTo` / `dragAndDrop` → timeout on all engines.
 *   - Manual mouse stepping → silent no-op on all engines.
 *   - Synthetic DragEvents carrying one shared DataTransfer → moves card on
 *     Chromium, Firefox, and WebKit.
 *
 * No WebKit-specific adjustment is needed because this approach bypasses the
 * browser's native drag machinery entirely — the per-engine differences that
 * plague mouse-based dragging don't apply.
 */
export class DragHelper {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Drags `card` (.KanbanCard) onto `column` (.octo-board-column) using
   * synthetic HTML5 DragEvents sharing one DataTransfer object.
   *
   * Event order (required by react-dnd HTML5 backend):
   *   dragstart (card) → dragenter (column) → dragover (column) →
   *   drop (column) → dragend (card)
   */
  async dragCardToColumn(card: Locator, column: Locator): Promise<void> {
    const [cardHandle, columnHandle] = await Promise.all([
      card.elementHandle(),
      column.elementHandle(),
    ]);

    if (!cardHandle || !columnHandle) {
      throw new Error('DragHelper: card or column element not found in DOM');
    }

    // page.evaluate with two separate ElementHandle args — each is serialized
    // as a live DOM reference into the page context, preserving react-dnd's
    // ability to read them as real elements.
    await this.page.evaluate(
      ({ card: cardEl, col: columnEl }) => {
        const dt = new DataTransfer();

        cardEl.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
        columnEl.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }));
        columnEl.dispatchEvent(new DragEvent('dragover',  { bubbles: true, cancelable: true, dataTransfer: dt }));
        columnEl.dispatchEvent(new DragEvent('drop',      { bubbles: true, cancelable: true, dataTransfer: dt }));
        cardEl.dispatchEvent(new DragEvent('dragend',     { bubbles: true, cancelable: true, dataTransfer: dt }));
      },
      { card: cardHandle, col: columnHandle },
    );
  }
}
