# Product Requirements Document
## Studioforma Production Tracker

**Version:** 1.0  
**Date:** 26 June 2026  
**Author:** Arav Agarwal  
**Client:** Abhiroop Agarwal, Director, Studioforma Industries

---

## 1. Problem Statement

Studioforma's production floor is currently tracked by Mr. Laxman, the production head, using a physical whiteboard. This breaks down under load: there is no full picture of all active orders at once, priorities get mixed up, and production delays follow because the team cannot see what is stuck and where. Clients and directors have no visibility without physically visiting the floor. There is no structured way to track drawing references, project names, SKU-level specifications, or stage-level notes alongside each order.

---

## 2. Goal

Build a browser-based production order tracker that gives Studioforma's team a real-time view of every active order, its SKUs, its current production stage, its delivery deadline, and any stage-level notes — accessible to all stakeholders via a URL, with editing restricted to authorised users via a PIN.

---

## 3. Users

| User | Role | Access Level |
|---|---|---|
| Mr. Laxman | Production Head | Edit mode (PIN required) — adds orders, moves stages, adds notes |
| Abhiroop Agarwal | Director | View only — monitors board |
| Production Team | Floor staff | View only — checks order status |
| Client | External stakeholder | View only — checks delivery status |

**Access model:** The app opens in view-only mode by default. A PIN entry (`SF2026`) unlocks edit mode. The PIN is a symbolic UX barrier — it prevents accidental edits, not malicious ones. Anyone with the GitHub source can see it; this is acceptable for MP2 scope.

---

## 4. Production Stages

Orders move forward only, through five stages in sequence:

1. Order Received
2. Material Sourced
3. In Production
4. Quality Check
5. Dispatched → moves to Completed section

---

## 5. Data Model

Each order object in the JavaScript `orders` array contains:

```javascript
{
  id: "SF-26JUN-001",           // auto-generated: SF-DDMON-NNN
  clientName: "Sharma Family",  // text field
  projectName: "Main Bedroom Wardrobe", // text field
  drawingRef: "DWG-2026-041",   // text field
  dueDate: "2026-07-10",        // date field
  currentStage: "In Production",// one of 5 stages
  dateAdded: "2026-06-26",      // auto-generated
  skus: [
    {
      productType: "Doors",     // dropdown: Doors, Wall Panels, Kitchen Shutters,
                                // Wardrobe, Flooring, Loose Furniture, Other
      quantity: 3,              // number
      unit: "Pieces",           // dropdown: Pieces, Square Feet
      size: "2100 x 900",       // text
      sizeUnit: "mm",           // dropdown: mm, M, ft
      thickness: "18",          // number (mm)
      material: "Teak Veneer",  // text
      additionalNotes: ""       // text
    }
  ],
  stageNotes: {
    "Order Received": "",
    "Material Sourced": "",
    "In Production": "",
    "Quality Check": "",
    "Dispatched": ""
  }
}
```

---

## 6. Feature Requirements

### 6.1 Add New Order
- Edit mode only
- Form fields: Client Name, Project Name, Drawing Reference, Due Date
- At least one SKU required before submission
- SKU fields per line item: Product Type (dropdown), Quantity (number), Unit (dropdown: Pieces / Square Feet), Size (text + unit selector: mm / M / ft), Thickness (number, mm), Material (text), Additional Notes (text)
- Ability to add multiple SKU rows before submitting
- Order ID auto-generated on submission: format `SF-DDMON-NNN` (e.g. `SF-26JUN-001`)
- Date added auto-generated on submission
- Empty form submission blocked with inline validation message

### 6.2 Order Card Display
Each active order displays:
- Order ID, Client Name, Project Name, Drawing Reference, Due Date, Date Added, Current Stage
- SKU table: one row per SKU showing all specification fields
- Stage notes for the current stage (if any)
- Advance Stage button (edit mode only)
- Overdue flag: if today's date is past Due Date and order is not Dispatched, card border and due date text turn red

### 6.3 Stage Transition
- Edit mode only
- "Advance Stage" button on each order card
- Optional text note field appears on click -- user can type a note before confirming
- On confirm: currentStage updates, note saved to stageNotes for that stage, dashboard recalculates, card re-renders
- Orders at "Quality Check" stage advance to "Dispatched" and immediately move to the Completed section

### 6.4 Live Dashboard
Always visible at the top of the page. Updates on every state change.

| Metric | Display |
|---|---|
| Total Active Orders | Large count — all orders not yet Dispatched |
| Order Received | Count |
| Material Sourced | Count |
| In Production | Count |
| Quality Check | Count |

### 6.5 Filter by Stage
- Dropdown above the order list: All, Order Received, Material Sourced, In Production, Quality Check
- Filters the rendered order cards without changing the underlying state
- Dashboard counts always reflect full state, not the filtered view

### 6.6 Completed Section
- Separate section below active orders
- Shows all Dispatched orders in collapsed cards (Order ID, Client, Project, Date Dispatched)
- Expandable to show full details and all stage notes

### 6.7 Edit Mode (PIN)
- "Edit Mode" toggle button always visible in the header
- Click prompts a PIN entry field
- Correct PIN (`SF2026`) enables edit mode: Add Order form appears, Advance Stage buttons appear
- Incorrect PIN: inline error message, no access
- "Exit Edit Mode" button returns to view-only

### 6.8 Empty State
- When no active orders exist, the order list area shows: "No active orders. Add your first order." with a prominent Add Order button (edit mode) or a neutral message (view mode)
- "Load Sample Data" button always visible on empty state -- populates board with 4 sample active orders across different stages and 2 completed orders to demonstrate functionality

### 6.9 Reset
- "Reset" button visible in edit mode only
- Clears completed orders only -- active orders are preserved
- Confirmation prompt before executing: "This will remove all completed orders. Continue?"
- Dashboard and completed section update immediately after reset

---

## 7. Interaction Types (MP2 Compliance)

| Interaction Type | Where |
|---|---|
| Form submit | Add New Order form |
| Button click | Advance Stage, Reset, Load Sample Data, Edit Mode toggle, Add SKU row |
| Dropdown select | Filter by Stage, Product Type, Unit, Size Unit |
| Text input | Client Name, Project Name, Drawing Ref, Stage Notes, PIN, SKU fields |
| Date input | Due Date |

Total: 5 distinct interaction types. Requirement is 3. Compliant.

---

## 8. Edge Cases and Error Handling

| Scenario | Behaviour |
|---|---|
| Form submitted with empty required fields | Inline validation, submission blocked |
| Order submitted with no SKUs | Blocked with message: "Add at least one item" |
| Wrong PIN entered | Inline error: "Incorrect PIN" — no access granted |
| Advance Stage clicked on final stage (Quality Check) | Moves to Dispatched, card moves to Completed section |
| Due date in the past on add | Allowed but card immediately flagged overdue in red |
| Reset clicked with no completed orders | Button disabled or message: "No completed orders to clear" |
| Load Sample Data clicked when orders already exist | Appends sample data to existing orders (does not overwrite) |

---

## 9. Visual Design

- Gold on black editorial aesthetic consistent with the Studioforma brand site
- Overdue orders: red border + red due date text
- Stage indicator: visible badge on each card showing current stage
- Dashboard: prominent counts at top, always in view
- Responsive: viewport meta tag present, layout holds at mobile widths
- No external libraries, no CDN imports

---

## 10. Out of Scope (MP2)

- Image or file uploads
- Cross-device data persistence (no backend, no database)
- User authentication (PIN is symbolic only)
- Email or push notifications for overdue orders
- Order editing after creation
- Multi-user real-time sync
- Export to PDF or CSV

These are candidates for MP3 (Airtable API integration) or the Final Project.

---

## 11. Success Metrics

- Mr. Laxman can add a full order with multiple SKUs in under 2 minutes
- Abhiroop can see all active orders and their stages at a glance without scrolling past the dashboard
- Overdue orders are immediately visible without manual checking
- A classmate can use the tool without any instructions from the builder
- All 5 CP3 requirements pass on first review