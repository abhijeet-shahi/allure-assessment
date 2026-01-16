/**
 * TASK B & C: Size Guide Drawer JavaScript
 * 
 * Handles drawer behavior and Storefront API integration for fetching metaobject data.
 * 
 * Features:
 * - Accessible drawer with focus management
 * - ESC key to close
 * - Focus trap while open
 * - Lazy loading of metaobject data
 * - Loading, empty, and error states
 * 
 * Security Trade-offs:
 * - Uses Storefront API (public, read-only) - safe for client-side use
 * - API token exposed in client code (acceptable for Storefront API)
 * - Only fetches public metaobject data
 * - No mutation capabilities
 * - Rate-limited by Shopify (60 requests/second)
 * 
 * IMPORTANT: Never expose Admin API credentials in client-side code.
 * The Storefront API token should have minimal scopes (read_products, read_metaobjects).
 */

(function () {
  'use strict';

  /**
   * GraphQL Query for fetching metaobjects
   * 
   * This query fetches metaobjects by type and retrieves:
   * - handle: unique identifier
   * - fields: title and body content
   * 
   * Assumptions:
   * - Metaobject has a field with key "title" (single_line_text_field)
   * - Metaobject has a field with key "body" (rich_text or multi_line_text_field)
   */
  const METAOBJECT_QUERY = `
    query GetMetaobjects($type: String!, $first: Int!) {
      metaobjects(type: $type, first: $first) {
        edges {
          node {
            handle
            fields {
              key
              value
            }
          }
        }
      }
    }
  `;

  /**
   * SizeGuideDrawer Class
   * Manages drawer state, accessibility, and API integration
   */
  class SizeGuideDrawer {
    constructor(trigger) {
      this.trigger = trigger;
      this.sectionId = trigger.dataset.sectionId;
      this.metaobjectType = trigger.dataset.metaobjectType || 'size_guide';
      this.emptyMessage = trigger.dataset.emptyMessage || 'No size guide available.';

      this.drawer = document.getElementById(`SizeGuideDrawer-${this.sectionId}`);
      this.panel = this.drawer.querySelector('.size-guide-drawer__panel');
      this.overlay = this.drawer.querySelector('[data-drawer-overlay]');
      this.closeButton = this.drawer.querySelector('[data-drawer-close]');
      this.content = this.drawer.querySelector('[data-drawer-content]');

      this.isOpen = false;
      this.dataFetched = false;
      this.focusableElements = [];
      this.previousFocus = null;

      this.init();
    }

    init() {
      // Bind event listeners
      this.trigger.addEventListener('click', () => this.open());
      this.closeButton.addEventListener('click', () => this.close());
      this.overlay.addEventListener('click', () => this.close());

      // ESC key handler
      this.handleEscape = this.handleEscape.bind(this);

      // Focus trap handler
      this.handleFocusTrap = this.handleFocusTrap.bind(this);
    }

    /**
     * Open the drawer
     */
    async open() {
      if (this.isOpen) return;

      this.isOpen = true;
      this.previousFocus = document.activeElement;

      // Show drawer
      this.drawer.removeAttribute('hidden');

      // Trigger reflow for animation
      this.drawer.offsetHeight;

      // Add open class for animation
      this.drawer.classList.add('is-open');

      // Update ARIA
      this.trigger.setAttribute('aria-expanded', 'true');

      // Prevent body scroll
      document.body.style.overflow = 'hidden';

      // Add event listeners
      document.addEventListener('keydown', this.handleEscape);
      this.drawer.addEventListener('keydown', this.handleFocusTrap);

      // Fetch data if not already fetched
      if (!this.dataFetched) {
        await this.fetchMetaobjectData();
      }

      // Set focus to close button
      setTimeout(() => {
        this.closeButton.focus();
        this.updateFocusableElements();
      }, 100);
    }

    /**
     * Close the drawer
     */
    close() {
      if (!this.isOpen) return;

      this.isOpen = false;

      // Remove open class for animation
      this.drawer.classList.remove('is-open');

      // Update ARIA
      this.trigger.setAttribute('aria-expanded', 'false');

      // Restore body scroll
      document.body.style.overflow = '';

      // Remove event listeners
      document.removeEventListener('keydown', this.handleEscape);
      this.drawer.removeEventListener('keydown', this.handleFocusTrap);

      // Hide drawer after animation
      setTimeout(() => {
        this.drawer.setAttribute('hidden', '');
      }, 300);

      // Return focus to trigger button
      if (this.previousFocus) {
        this.previousFocus.focus();
      }
    }

    /**
     * Handle ESC key press
     */
    handleEscape(event) {
      if (event.key === 'Escape' || event.keyCode === 27) {
        this.close();
      }
    }

    /**
     * Focus trap implementation
     * Keeps focus within the drawer while open
     */
    handleFocusTrap(event) {
      if (event.key !== 'Tab' && event.keyCode !== 9) return;

      if (this.focusableElements.length === 0) return;

      const firstElement = this.focusableElements[0];
      const lastElement = this.focusableElements[this.focusableElements.length - 1];

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }

    /**
     * Update list of focusable elements for focus trap
     */
    updateFocusableElements() {
      const focusableSelectors = [
        'a[href]',
        'button:not([disabled])',
        'textarea:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
      ];

      this.focusableElements = Array.from(
        this.panel.querySelectorAll(focusableSelectors.join(','))
      ).filter(el => {
        return el.offsetParent !== null; // Only visible elements
      });
    }

    /**
     * TASK C: Fetch metaobject data from Storefront API
     * 
     * Security considerations:
     * - Storefront API is public and read-only (safe for client-side)
     * - Token should be scoped to read_products and read_metaobjects only
     * - No sensitive data should be stored in metaobjects
     * - Rate limiting handled by Shopify
     */
    async fetchMetaobjectData() {
      this.showLoading();

      try {
        // Get Storefront API credentials from theme settings
        // In production, these would be injected via Liquid from theme settings
        const storefrontToken = this.getStorefrontToken();
        const shopDomain = this.getShopDomain();

        if (!storefrontToken || !shopDomain) {
          throw new Error('Storefront API credentials not configured');
        }

        const response = await fetch(`https://${shopDomain}/api/2024-01/graphql.json`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Storefront-Access-Token': storefrontToken
          },
          body: JSON.stringify({
            query: METAOBJECT_QUERY,
            variables: {
              type: this.metaobjectType,
              first: 1 // Get the first matching metaobject
            }
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Check for GraphQL errors
        if (data.errors) {
          throw new Error(data.errors[0].message);
        }

        // Extract metaobject data
        const metaobjects = data.data?.metaobjects?.edges || [];

        if (metaobjects.length === 0) {
          this.showEmpty();
          return;
        }

        // Get first metaobject
        const metaobject = metaobjects[0].node;
        const fields = this.parseMetaobjectFields(metaobject.fields);

        this.renderContent(fields);
        this.dataFetched = true;

      } catch (error) {
        console.error('Error fetching metaobject data:', error);
        this.showError(error.message);
      }
    }

    /**
     * Parse metaobject fields into a usable object
     * Handles both plain text and JSON-formatted rich text fields
     */
    parseMetaobjectFields(fields) {
      const parsed = {};
      fields.forEach(field => {
        let value = field.value;

        // Try to parse JSON fields (rich text fields are stored as JSON)
        if (typeof value === 'string' && value.trim().startsWith('{')) {
          try {
            const jsonValue = JSON.parse(value);
            // If it's a rich text field with children, convert to HTML
            if (jsonValue.type === 'root' && jsonValue.children) {
              value = this.convertRichTextToHTML(jsonValue);
            } else {
              value = jsonValue;
            }
          } catch (e) {
            // If parsing fails, keep the original value
            value = field.value;
          }
        }

        parsed[field.key] = value;
      });
      return parsed;
    }

    /**
     * Convert Shopify rich text JSON to HTML
     * Handles the rich text format returned by metaobject fields
     */
    convertRichTextToHTML(richText) {
      if (!richText || !richText.children) {
        return '';
      }

      let html = '';

      richText.children.forEach(node => {
        if (node.type === 'paragraph') {
          html += this.renderParagraph(node);
        } else if (node.type === 'heading') {
          html += this.renderHeading(node);
        } else if (node.type === 'list') {
          html += this.renderList(node);
        } else if (node.type === 'table') {
          html += this.renderTable(node);
        }
      });

      return html;
    }

    /**
     * Render a paragraph node
     */
    renderParagraph(node) {
      if (!node.children) return '';

      let content = '';
      node.children.forEach(child => {
        if (child.type === 'text') {
          content += child.value || '';
        }
      });

      return `<p>${content}</p>`;
    }

    /**
     * Render a heading node
     */
    renderHeading(node) {
      if (!node.children) return '';

      const level = node.level || 2;
      let content = '';
      node.children.forEach(child => {
        if (child.type === 'text') {
          content += child.value || '';
        }
      });

      return `<h${level}>${content}</h${level}>`;
    }

    /**
     * Render a list node (ordered or unordered)
     */
    renderList(node) {
      if (!node.children) return '';

      const tag = node.listType === 'ordered' ? 'ol' : 'ul';
      let items = '';

      node.children.forEach(child => {
        if (child.type === 'list-item' && child.children) {
          let itemContent = '';
          child.children.forEach(itemChild => {
            if (itemChild.type === 'text') {
              itemContent += itemChild.value || '';
            }
          });
          items += `<li>${itemContent}</li>`;
        }
      });

      return `<${tag}>${items}</${tag}>`;
    }

    /**
     * Render inline nodes (text, bold, italic, etc.)
     */
    renderInlineNode(node) {
      if (node.type === 'text') {
        let text = node.value || '';

        // Handle formatting
        if (node.bold) text = `<strong>${text}</strong>`;
        if (node.italic) text = `<em>${text}</em>`;

        return text;
      }
      return '';
    }

    /**
     * Render a table node
     */
    renderTable(node) {
      if (!node.children) return '';

      let tableHTML = '<table>';
      let hasHeader = false;

      node.children.forEach((row, rowIndex) => {
        if (row.type === 'table-row' && row.children) {
          // First row is typically the header
          if (rowIndex === 0) {
            tableHTML += '<thead><tr>';
            row.children.forEach(cell => {
              if (cell.type === 'table-cell' && cell.children) {
                let cellContent = '';
                cell.children.forEach(child => {
                  cellContent += this.renderInlineNode(child);
                });
                tableHTML += `<th>${cellContent}</th>`;
              }
            });
            tableHTML += '</tr></thead><tbody>';
            hasHeader = true;
          } else {
            tableHTML += '<tr>';
            row.children.forEach(cell => {
              if (cell.type === 'table-cell' && cell.children) {
                let cellContent = '';
                cell.children.forEach(child => {
                  cellContent += this.renderInlineNode(child);
                });
                tableHTML += `<td>${cellContent}</td>`;
              }
            });
            tableHTML += '</tr>';
          }
        }
      });

      if (hasHeader) {
        tableHTML += '</tbody>';
      }
      tableHTML += '</table>';

      return tableHTML;
    }

    /**
     * Get Storefront API token from theme settings
     * In production, this would be injected via Liquid template
     */
    getStorefrontToken() {
      // This should be injected via Liquid in production:
      // {{ settings.storefront_api_token }}
      // For now, we'll check for a meta tag or window variable
      const meta = document.querySelector('meta[name="shopify-storefront-token"]');
      return meta?.content || window.Shopify?.storefrontToken || '';
    }

    /**
     * Get shop domain
     */
    getShopDomain() {
      // Shopify provides this in the Shopify object
      return window.Shopify?.shop || '';
    }

    /**
     * Show loading state
     */
    showLoading() {
      this.content.innerHTML = `
        <div class="size-guide-drawer__loading">
          <div class="loading-spinner"></div>
          <p>Loading size guide...</p>
        </div>
      `;
    }

    /**
     * Show empty state
     */
    showEmpty() {
      this.content.innerHTML = `
        <div class="size-guide-drawer__empty">
          <p>${this.escapeHtml(this.emptyMessage)}</p>
        </div>
      `;
    }

    /**
     * Show error state
     */
    showError(message) {
      this.content.innerHTML = `
        <div class="size-guide-drawer__error">
          <h3 class="size-guide-drawer__error-title">Unable to load size guide</h3>
          <p class="size-guide-drawer__error-message">${this.escapeHtml(message)}</p>
        </div>
      `;
    }

    /**
     * Render metaobject content
     */
    renderContent(fields) {
      const title = fields.title || 'Size Guide';
      const body = fields.body || '';

      this.content.innerHTML = `
        <div class="size-guide-drawer__data">
          <h3>${this.escapeHtml(title)}</h3>
          <div class="size-guide-drawer__data-body">
            ${body}
          </div>
        </div>
      `;

      // Update focusable elements after content is rendered
      this.updateFocusableElements();
    }

    /**
     * Escape HTML to prevent XSS
     * Important security measure when rendering user-generated content
     */
    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  }

  /**
   * Initialize all size guide drawers on the page
   */
  function initSizeGuideDrawers() {
    const triggers = document.querySelectorAll('[data-size-guide-trigger]');
    triggers.forEach(trigger => {
      new SizeGuideDrawer(trigger);
    });
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSizeGuideDrawers);
  } else {
    initSizeGuideDrawers();
  }

  // Re-initialize on Shopify section events (for theme editor)
  document.addEventListener('shopify:section:load', initSizeGuideDrawers);
  document.addEventListener('shopify:section:reorder', initSizeGuideDrawers);

})();
