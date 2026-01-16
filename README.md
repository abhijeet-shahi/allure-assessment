# 📘 Shopify Front-End Developer Assignment

This repo implements Tasks **A–D** for the Shopify Front-End Developer assignment:
Theme customization (Liquid), accessible JS drawer, Storefront API metaobject fetch, and a Customer Account UI Extension.

---

## Setup Instructions

### 1) Theme Setup (Tasks A–C)

- Upload the `theme/` folder to your Shopify dev store (Dawn)
- Add the section **“Product Key Info + Size Guide”** to a product template
- Ensure at least one product exists

---

### 2) Metaobject Setup (Task C)

In Shopify Admin → **Settings** → **Data** → **Metaobjects**:

1. **Create Definition**:
   - Type: `size_guide`
   - Display Name: Size Guide

2. **Add Fields**:
   | Field | Type |
   |-------|------|
   | title | Single line text |
   | body | Rich text |

3. **Create Entry** with representative data (e.g., shoe sizing chart)

---

### 3) Storefront API Setup (Task C)

In Shopify Admin:

1. Go to **Settings** → **Apps and integrations** → **Develop apps**
2. Create new app (or select existing)
3. Go to **Configuration** tab
4. Under **Storefront API** → Enable:
   - `unauthenticated_read_metaobjects`
   - `unauthenticated_read_products`
5. Copy **Storefront API access token**
6. Paste token in product info size theme settings

---

### 4) App + Customer Account UI Extension Setup (Task D)

```bash
# Create new app
shopify app create node order-support-helper
cd order-support-helper

# Generate extension
shopify app generate extension
# Select: "Customer account UI extension"

# Copy this repo's extension code:
cp ../../app/order-support-helper/extensions/order-status-helper/src/OrderStatusBlock.jsx \
   extensions/order-status-helper/src/

# Test locally
shopify app dev

# Deploy to production
shopify app deploy
```

**In Shopify Admin**:
1. **Settings** → **Customer accounts** → Enable **New customer accounts**
2. Navigate to any **Customer Order Page**
3. Add **Order Support Helper** extension block

---

##  Features & Where to See Them

### Task A – Product Page Section
**Location**: Product page (any theme)

**What it does**:
- ✅ Displays product title, price, and variant selector
- ✅ Configurable "Size Guide" button (customizable label in Theme Editor)
- ✅ Fully configurable via Theme Editor schema

**File**: [theme/sections/product-key-info-size-guide.liquid](theme/sections/product-key-info-size-guide.liquid)

**Screenshot**: 

<img width="1895" height="895" alt="image" src="https://github.com/user-attachments/assets/798f3bc4-5133-4517-a44e-9a2a97657a13" />


---

### Task B – Size Guide Drawer (Vanilla JavaScript)
**Location**: Product page → Click "Size Guide" button

**What it does**:
- ✅ Smooth open/close CSS transitions (no external libraries)
- ✅ **Accessible behavior**:
  - ESC key closes panel
  - Focus moves into drawer on open, returns on close
  - ARIA attributes: `role="dialog"`, `aria-labelledby`, `aria-modal`
  - Keyboard navigation confined within panel
- ✅ Vanilla ES6+ JavaScript (zero dependencies)

**File**: [theme/assets/product-size-guide.js](theme/assets/product-size-guide.js)

**CSS**: [theme/assets/product-size-guide.css](theme/assets/product-size-guide.css)

**Screenshot**: 

<img width="1916" height="941" alt="image" src="https://github.com/user-attachments/assets/7bd7d53f-f854-4288-975f-53299c7880a3" />

---

### Task C – Storefront API Integration (GraphQL)
**Location**: Drawer panel content

**What it does**:
- ✅ Fetches `size_guide` metaobject via Storefront GraphQL API
- ✅ Renders title and body inside drawer
- ✅ Handles loading, empty, and error states gracefully
- ✅ No external data-fetching libraries

**Query**: [graphql/size-guide-metaobject-query.graphql](graphql/size-guide-metaobject-query.graphql)

```graphql
query GetSizeGuideMetaobjects($type: String!, $first: Int = 1) {
  metaobjects(type: $type, first: $first) {
    edges {
      node {
        id
        fields { key value }
      }
    }
  }
}
```

**API Call** (from [theme/assets/product-size-guide.js](theme/assets/product-size-guide.js)):

```javascript
async function fetchSizeGuideData(metaobjectType) {
  const token = window.Shopify.storefrontToken;
  const shop = window.Shopify.shop;
  
  const response = await fetch(`https://${shop}/api/2024-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token,
    },
    body: JSON.stringify({
      query: QUERY,
      variables: { type: metaobjectType },
    }),
  });

  const data = await response.json();
  return data.data?.metaobjects?.edges[0]?.node || null;
}
```

**Screenshot**: 

<img width="1912" height="888" alt="image" src="https://github.com/user-attachments/assets/0b214bff-e38c-42de-b00c-ffc5f76dd173" />


---

### Task D – Customer Account UI Extension
**Location**: Customer Account → Order Page

**What it does**:
- ✅ Displays on customer order pages
- ✅ Shows help message: "Need help with your order?"
- ✅ Displays dynamic order number
- ✅ **Copy Order #** button (clipboard functionality)
- ✅ **Contact Support** button opens modal popup
- ✅ Support form with order number, email, and message fields

**File**: [app/order-support-helper/extensions/order-status-helper/src/OrderStatusBlock.jsx](app/order-support-helper/extensions/order-status-helper/src/OrderStatusBlock.jsx)

**Screenshot**: 

<img width="1905" height="977" alt="image" src="https://github.com/user-attachments/assets/421b4c93-cb55-4143-af50-e021f9ff8c60" />

---

## 🔐 API Usage + Security Note (Important)

### Current Implementation

The Storefront API is called **client-side** for simplicity (timeboxed assessment scope).

**Trade-off**: No backend proxy required, but token visible in browser.

**Security Consideration**:

The token is injected into the frontend via Liquid:

```liquid
<script>
  window.Shopify = window.Shopify || {};
  window.Shopify.storefrontToken = {{ section.settings.storefront_api_token | json }};
  window.Shopify.shop = {{ shop.permanent_domain | json }};
</script>
```

This means the Storefront token is visible in browser source.

### Mitigation

✅ Token is **scoped to read-only permissions**:
- `unauthenticated_read_metaobjects` (metaobjects only)
- `unauthenticated_read_products` (product data only)

✅ No write operations possible (scope prevents)

✅ No customer personal data exposed (metaobjects are public by design)

### Production Recommendation

For production, implement **Backend Proxy Pattern**:

```
Frontend → Your Backend API → Shopify Storefront API
```

**Benefits**:
- Token managed server-side (never exposed)
- Request validation and rate limiting
- Response sanitization
- Caching layer for performance

---

## 📁 Repository Structure

```
allure-assessment/
├── README.md                                      (this file)
├── theme/
│   ├── sections/
│   │   └── product-key-info-size-guide.liquid    ✅ Task A
│   ├── assets/
│       ├── product-size-guide.js                 ✅ Task B, C
│       └── product-size-guide.css                ✅ Task B
├── graphql/
│   └── size-guide-metaobject-query.graphql       ✅ Task C
├── app/
    └── order-support-helper/
        ├── shopify.app.toml
        └── extensions/
            └── order-status-helper/
                └── src/
                    └── OrderStatusBlock.jsx      ✅ Task D
```

---

## ⚠️ Known Limitations / TODOs

| Limitation | Impact | Workaround | Priority |
|-----------|--------|-----------|----------|
| **Storefront token in JS** | Token visible in browser | Backend proxy API | High |
| **No request caching** | Repeated API calls on drawer reopen | localStorage cache with TTL | Medium |
| **No backend support form** | Support form uses `mailto:` only | Shopify Forms app or custom backend | High |
| **Static size guide** | Same data for all products | Product-specific metaobject references | Medium |
| **Basic error messages** | Generic error text | Detailed logging (Sentry) | Low |

### TODOs for Production

- [ ] Implement **backend proxy** for API calls (move token server-side)
- [ ] Add **client-side caching** using localStorage with TTL
- [ ] Add **multi-language support** (i18n)
- [ ] Performance audit: **Lighthouse**, **Core Web Vitals**

---

## 🛡️ Security & Performance

### API Security

**Token Scope**:
```
✅ unauthenticated_read_metaobjects (read-only)
✅ unauthenticated_read_products (read-only)
❌ NO write operations possible
❌ NO customer data accessible
```

**Data Validation**:
```javascript
// Always validate API responses
function renderMetaobjectData(data) {
  if (!data || typeof data !== 'object') {
    return renderErrorState();
  }
  
  const title = data.fields?.find(f => f.key === 'title')?.value;
  const body = data.fields?.find(f => f.key === 'body')?.value;

  // Use textContent (prevents XSS)
  panelTitle.textContent = title || 'Untitled';
  panelBody.textContent = body || 'No content';
}
```

---

## Proof of Functionality

- Preview link: - https://abhijeetstore1.myshopify.com/?country=IN&preview_theme_id=146272944263
- Password: - abhijeet
- Video of my work: - https://www.awesomescreenshot.com/video/48449196?key=fe0bfe9620435c235b8fbe687118f3ee
  

