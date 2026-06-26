# MP2 Proposal: Studioforma Production Tracker

## What I'm building

A browser-based production order tracker that lets Studioforma's team log new manufacturing orders — each containing multiple SKUs — and move them through five production stages in real time, with a live dashboard showing how many orders are at each stage.

## Who it's for / why

**User: Abhiroop Agarwal, Director, Studioforma Industries**

Studioforma's production floor is currently managed by Mr. Laxman, the production head, using a physical whiteboard to track order progress across stages. This system breaks down under load: there is no full picture of all active orders at once, priorities get mixed up, and production delays follow because the team cannot see what is stuck and where. Each order can contain multiple product types (SKUs), and the current system has no structured way to track drawing reference numbers, project names, or stage-level notes alongside each order.

Abhiroop needs a digital tool that gives him and Mr. Laxman a clear, real-time view of every order's status — including all SKUs within it — without switching to a spreadsheet or a full ERP system.

## The state it tracks

An array of order objects held in JavaScript. Each order stores:

- Order ID (auto-generated)
- Client name (e.g. Sharma Family)
- Project name (e.g. Ireo Ascott - Describes specific project under client)
- Drawing reference number (text)
- SKUs: an array of production items, each with product type, quantity, specifications and unit
- Stage notes: a text description for each production stage
- Current production stage
- Date added

The dashboard derives a live count of orders at each stage from this array every time the state changes.

## Core features

1. Add a new order via a form, including client name, project name, drawing reference, and one or more SKU line items (product type + quantity + unit)
2. Move any order forward through five production stages: Order Received, Material Sourced, In Production, Quality Check, Dispatched
3. Add a text note at each stage transition to record what happened
4. Live dashboard showing order count at each stage, updated on every interaction
5. Filter the order list by production stage using a dropdown
6. Reset all orders and clear the dashboard without refreshing the page

## What I don't know yet

- How to dynamically create and update DOM elements (order cards with SKU tables) from a JavaScript array without reloading the page
- How to filter an array and re-render only the matching subset to the DOM
- How to manage stage transitions in state: updating a specific object inside an array and reflecting that change across both the order list and the dashboard counts
