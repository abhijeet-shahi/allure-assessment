/**
 * Handles drawer behavior and Storefront API integration for fetching metaobject data.
 */

(function () {
  'use strict';

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
      
      this.trigger.addEventListener('click', () => this.open());
      this.closeButton.addEventListener('click', () => this.close());
      this.overlay.addEventListener('click', () => this.close());

    
      this.handleEscape = this.handleEscape.bind(this);

      this.handleFocusTrap = this.handleFocusTrap.bind(this);
    }

   
    async open() {
      if (this.isOpen) return;

      this.isOpen = true;
      this.previousFocus = document.activeElement;

      
      this.drawer.removeAttribute('hidden');

      this.drawer.offsetHeight;

     
      this.drawer.classList.add('is-open');

      this.trigger.setAttribute('aria-expanded', 'true');

      document.body.style.overflow = 'hidden';

      document.addEventListener('keydown', this.handleEscape);
      this.drawer.addEventListener('keydown', this.handleFocusTrap);


      if (!this.dataFetched) {
        await this.fetchMetaobjectData();
      }

      setTimeout(() => {
        this.closeButton.focus();
        this.updateFocusableElements();
      }, 100);
    }

   
    close() {
      if (!this.isOpen) return;

      this.isOpen = false;

      this.drawer.classList.remove('is-open');

     
      this.trigger.setAttribute('aria-expanded', 'false');

 
      document.body.style.overflow = '';

    
      document.removeEventListener('keydown', this.handleEscape);
      this.drawer.removeEventListener('keydown', this.handleFocusTrap);

      
      setTimeout(() => {
        this.drawer.setAttribute('hidden', '');
      }, 300);


      if (this.previousFocus) {
        this.previousFocus.focus();
      }
    }

  
    handleEscape(event) {
      if (event.key === 'Escape' || event.keyCode === 27) {
        this.close();
      }
    }

  
    handleFocusTrap(event) {
      if (event.key !== 'Tab' && event.keyCode !== 9) return;

      if (this.focusableElements.length === 0) return;

      const firstElement = this.focusableElements[0];
      const lastElement = this.focusableElements[this.focusableElements.length - 1];

      if (event.shiftKey) {
      
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
       
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }

   
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
        return el.offsetParent !== null; 
      });
    }

  
    async fetchMetaobjectData() {
      this.showLoading();

      try {
      
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

       
        if (data.errors) {
          throw new Error(data.errors[0].message);
        }

       
        const metaobjects = data.data?.metaobjects?.edges || [];

        if (metaobjects.length === 0) {
          this.showEmpty();
          return;
        }

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

    
    renderInlineNode(node) {
      if (node.type === 'text') {
        let text = node.value || '';

     
        if (node.bold) text = `<strong>${text}</strong>`;
        if (node.italic) text = `<em>${text}</em>`;

        return text;
      }
      return '';
    }

   
    renderTable(node) {
      if (!node.children) return '';

      let tableHTML = '<table>';
      let hasHeader = false;

      node.children.forEach((row, rowIndex) => {
        if (row.type === 'table-row' && row.children) {
          
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
      const meta = document.querySelector('meta[name="shopify-storefront-token"]');
      return meta?.content || window.Shopify?.storefrontToken || '';
    }

   
    getShopDomain() {
      return window.Shopify?.shop || '';
    }

   
    showLoading() {
      this.content.innerHTML = `
        <div class="size-guide-drawer__loading">
          <div class="loading-spinner"></div>
          <p>Loading size guide...</p>
        </div>
      `;
    }

    
    showEmpty() {
      this.content.innerHTML = `
        <div class="size-guide-drawer__empty">
          <p>${this.escapeHtml(this.emptyMessage)}</p>
        </div>
      `;
    }

   
    showError(message) {
      this.content.innerHTML = `
        <div class="size-guide-drawer__error">
          <h3 class="size-guide-drawer__error-title">Unable to load size guide</h3>
          <p class="size-guide-drawer__error-message">${this.escapeHtml(message)}</p>
        </div>
      `;
    }

   
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

 
  function initSizeGuideDrawers() {
    const triggers = document.querySelectorAll('[data-size-guide-trigger]');
    triggers.forEach(trigger => {
      new SizeGuideDrawer(trigger);
    });
  }

 
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSizeGuideDrawers);
  } else {
    initSizeGuideDrawers();
  }

  document.addEventListener('shopify:section:load', initSizeGuideDrawers);
  document.addEventListener('shopify:section:reorder', initSizeGuideDrawers);

})();
