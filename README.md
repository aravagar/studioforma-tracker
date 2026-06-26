# Studioforma Production Tracker

A browser-based order tracking tool built for Studioforma Industries, a modular furniture manufacturer based in Delhi. The tracker gives the production team a real-time view of every active order, its SKUs, current production stage, and delivery deadline, replacing a physical whiteboard system that was causing priority mix-ups and delays.

**Live site:** [aravagar.github.io/studioforma-tracker](https://aravagar.github.io/studioforma-tracker)

Built for OIM3690: AI-Powered Web Development, Babson College, Summer 2026.

---

## The Problem

Studioforma's production floor was managed using a physical whiteboard. With multiple concurrent orders, each containing different product types and quantities, the whiteboard broke down: no full picture of all active orders at once, no record of stage-level notes, and no way for the director or client to check status without walking the floor. Production delays followed.

---

## Who Uses It

| User             | Role                                                        |
| ---------------- | ----------------------------------------------------------- |
| Mr. Laxman       | Production Head -- adds orders, advances stages, logs notes |
| Abhiroop Agarwal | Director -- monitors the board in view mode                 |
| Production Team  | Floor staff -- checks order status in view mode             |
| Client           | Checks production status in view mode                       |

---

## How to Use It

### View Mode (default)

Open the live URL. The dashboard and all active orders are visible immediately. No login required.

### Edit Mode

Click **Enter Edit Mode** in the top right. Enter PIN: **SF2026**. This unlocks the Add Order form and stage controls.

To exit edit mode, click **Exit Edit Mode**.

### Adding an Order

1. Enter edit mode
2. Fill in Client Name, Project Name, Drawing Reference, and Due Date
3. Add one or more SKU line items (product type, quantity, unit, size, thickness, material)
4. Click **Add Order**

The order appears on the board immediately under **Order Received**. A green flash confirms it was added.

### Moving an Order Through Stages

Each active order card has a **Move to [Next Stage]** button in edit mode. Optionally type a stage note before advancing. The five main stages are:

1. Order Received
2. Material Sourced
3. In Production
4. Quality Check
5. Dispatched (moves to Completed section)

### In Production Sub-Stages

When an order reaches **In Production**, a segmented progress track appears inside the card:

**Carpentry > Painting > Finishing**

Advance through each sub-stage one at a time. The **Move to Quality Check** button is locked until the order reaches **Finishing**. This prevents orders from skipping production steps.

### Filtering

Use the **Filter** dropdown above the board to show only orders at a specific stage. Dashboard counts always reflect the full state regardless of filter.

### Completed Orders

Dispatched orders move to the **Completed Orders** section at the bottom. Click any completed card to expand it and see the full stage history and notes.

### Reset

In edit mode, a **Clear Completed** button appears when there are dispatched orders. It requires a two-step inline confirmation before executing. Active orders are never affected by reset.

### Load Sample Data

Click **Load Sample Data** (visible on the empty state or in the board controls) to populate the board with 4 active orders across different stages and 2 completed orders. Useful for demos. Sample data will not overwrite orders you have already added.

---

## Features

### Core

- Add orders with multiple SKU line items per order
- Each order tracks: client name, project name, drawing reference, due date, SKUs, stage notes, and sub-stage
- Five main production stages with optional notes at each transition
- In Production sub-stages: Carpentry, Painting, Finishing (advance one at a time, locked until complete)
- Live dashboard showing total active orders and count per stage, updates on every interaction
- Filter active orders by stage
- Overdue orders flagged in red (past due date, not yet dispatched)
- Completed section with expandable cards showing full stage history
- Reset clears completed orders only, active orders preserved
- PIN-gated edit mode (symbolic barrier, not authentication)

### Data and State

- All state held in a JavaScript array of order objects
- Every interaction reads from and writes to the same array
- Derived output (dashboard counts, overdue flags, filter results) computed from state on every render
- localStorage persistence: orders survive page refresh, stored as JSON, loaded on init with try/catch fallback

### UX Polish

- New order card flashes green on add
- Dashboard counts animate on change
- Stage progress bar on every active order card
- Sub-stage segmented track with active, done, and pending states
- Inline two-step reset confirmation (no browser dialogs)
- Filter shows a clear message when no orders match the selected stage
- Rapid-click protection on advance buttons
- Removing the last SKU row is blocked with an inline error
- Sidebar collapses to a slim toggle button

---

## Data Model

Each order in the `orders` array:

```javascript
{
  id: "SF-26JUN-001",          // auto-generated: SF-DDMON-NNN
  clientName: "Sharma Family",
  projectName: "Ireo Ascott Master Bedroom",
  drawingRef: "DWG-2026-019",
  dueDate: "2026-07-10",
  currentStage: "In Production",
  subStage: "Painting",        // Carpentry | Painting | Finishing
  subStageNotes: {
    "Carpentry": "Carcass completed on 24 Jun"
  },
  dateAdded: "2026-06-22",
  skus: [
    {
      productType: "Wardrobe",
      quantity: 2,
      unit: "Pieces",
      size: "2400 x 600",
      sizeUnit: "mm",
      thickness: "18",
      material: "White Laminate",
      additionalNotes: "Soft close hinges"
    }
  ],
  stageNotes: {
    "Order Received": "Rush order",
    "Material Sourced": "Acrylic panels sourced from Noida",
    "In Production": "",
    "Quality Check": "",
    "Dispatched": ""
  }
}
```

---

## Tech Decisions

**Vanilla JavaScript only.** No frameworks, no libraries, no CDN imports. Every DOM update, event listener, and state mutation is written by hand. This was a deliberate constraint of the assignment and a meaningful learning choice: understanding how the DOM actually works without a framework abstracting it away.

**State-driven rendering.** The `renderOrders()` function clears and rebuilds the order list from the `orders` array on every state change. This means the UI is always a direct reflection of the data -- no possibility of the DOM getting out of sync with state.

**localStorage for persistence.** Orders are serialized to JSON and saved on every mutation. On load, the saved data is parsed and validated (must be an array) before trusting it. A try/catch around both operations means a corrupted localStorage entry falls back to an empty board rather than crashing the app.

**No `window.confirm()` or `alert()`.** All feedback and confirmation flows are inline DOM elements. The reset confirmation is a two-step click pattern with an inline warning box.

**XSS protection.** All user-supplied text is passed through `escapeHTML()` before being written to `innerHTML`. This prevents a client name or project name containing `<script>` tags from executing in the DOM.

**Rapid-click protection.** An `advanceLock` Set tracks in-flight advance operations. If a button is clicked while its order ID is in the lock, the click is ignored. The lock clears after 600ms.

---

## File Structure

```
studioforma-tracker/
├── index.html          -- semantic HTML structure
├── css/
│   └── styles.css      -- all styling, CSS custom properties, responsive rules
├── js/
│   └── app.js          -- all state, logic, DOM rendering, event listeners
├── PROPOSAL.md         -- project proposal (what, who, why, state, features)
├── PRD.md              -- product requirements document (generated with AI)
└── README.md           -- this file
```

---

## What I Learned

**State before DOM.** The most important shift in thinking was planning the data structure before writing any HTML. Once the shape of an order object was clear, every feature followed naturally from it. When sub-stages were added, adding a `subStage` field to the object made the rest fall into place.

**Re-rendering from state is the right default.** Early instinct was to find the specific card in the DOM and update just that element. The correct approach -- clearing and rebuilding from the array -- is simpler, less error-prone, and easier to reason about. The performance cost at this scale is zero.

**localStorage is three lines but the edge cases matter.** The save and load calls are trivial. What takes thought is what happens when they fail: corrupted data, storage quota exceeded, private browsing mode. Wrapping both in try/catch and validating the parsed result before using it is the difference between a fragile and a robust implementation.

**AI-assisted development requires understanding, not just output.** Every function in this project was reviewed, tested, and in several cases rewritten after seeing how it behaved in the browser. The AI interaction process documented in the weekly logs captures where the generated code needed to be changed to match the actual requirements -- which happened on nearly every feature.

---

## Built With

- HTML5, CSS3, Vanilla JavaScript (ES6+)
- GitHub Pages for deployment
- No frameworks, libraries, or external dependencies

---

_Mini Project 2 -- OIM3690 AI-Powered Web Development, Summer 2026, Babson College_
