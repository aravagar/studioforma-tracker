/* ============================================================
   STUDIOFORMA PRODUCTION TRACKER — app.js
   Iteration 1: State + Add Order + Render + Dashboard
   ============================================================ */

/* ----------------------------------------------------------
   1. STATE
   ---------------------------------------------------------- */

const STAGES = [
  "Order Received",
  "Material Sourced",
  "In Production",
  "Quality Check",
  "Dispatched"
];

const PRODUCT_TYPES = [
  "Doors",
  "Wall Panels",
  "Kitchen Shutters",
  "Wardrobe",
  "Flooring",
  "Loose Furniture",
  "Other"
];

const PIN = "SF2026";

let orders = [];          // array of order objects
let editMode = false;     // whether edit mode is unlocked
let orderCounter = 0;     // for sequential order ID suffix
let currentFilter = "All"; // current stage filter

/* ----------------------------------------------------------
   2. UTILITIES
   ---------------------------------------------------------- */

function generateOrderId() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const mon = months[now.getMonth()];
  orderCounter++;
  const num = String(orderCounter).padStart(3, "0");
  return `SF-${day}${mon}-${num}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d} ${months[Number(m) - 1]} ${y}`;
}

function isOverdue(order) {
  if (!order.dueDate || order.currentStage === "Dispatched") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(order.dueDate);
  return due < today;
}

function getStageBadgeClass(stage) {
  const map = {
    "Order Received": "received",
    "Material Sourced": "material",
    "In Production": "production",
    "Quality Check": "qc",
    "Dispatched": "dispatched"
  };
  return map[stage] || "";
}

/* ----------------------------------------------------------
   3. DASHBOARD
   ---------------------------------------------------------- */

function updateDashboard() {
  const active = orders.filter(o => o.currentStage !== "Dispatched");
  document.getElementById("count-total").textContent = active.length;
  document.getElementById("count-received").textContent =
    active.filter(o => o.currentStage === "Order Received").length;
  document.getElementById("count-material").textContent =
    active.filter(o => o.currentStage === "Material Sourced").length;
  document.getElementById("count-production").textContent =
    active.filter(o => o.currentStage === "In Production").length;
  document.getElementById("count-qc").textContent =
    active.filter(o => o.currentStage === "Quality Check").length;
}

/* ----------------------------------------------------------
   4. RENDER ORDER CARDS
   ---------------------------------------------------------- */

function renderOrders() {
  const container = document.getElementById("orders-container");
  const emptyState = document.getElementById("empty-state");

  const activeOrders = orders.filter(o => o.currentStage !== "Dispatched");

  // Apply filter
  const filtered = currentFilter === "All"
    ? activeOrders
    : activeOrders.filter(o => o.currentStage === currentFilter);

  // Clear existing cards (not empty state)
  const existingCards = container.querySelectorAll(".order-card");
  existingCards.forEach(c => c.remove());

  if (activeOrders.length === 0) {
    emptyState.classList.remove("hidden");
  } else {
    emptyState.classList.add("hidden");

    filtered.forEach(order => {
      const card = buildOrderCard(order);
      container.appendChild(card);
    });
  }

  renderCompleted();
  updateDashboard();
}

function buildOrderCard(order) {
  const overdue = isOverdue(order);
  const card = document.createElement("article");
  card.className = "order-card" + (overdue ? " overdue" : "");
  card.dataset.id = order.id;

  // Current stage note
  const currentNote = order.stageNotes[order.currentStage] || "";

  // SKU table rows
  const skuRows = order.skus.map(sku => `
    <tr>
      <td>${sku.productType}</td>
      <td>${sku.quantity} ${sku.unit}</td>
      <td>${sku.size ? sku.size + " " + sku.sizeUnit : "—"}</td>
      <td>${sku.thickness ? sku.thickness + " mm" : "—"}</td>
      <td>${sku.material || "—"}</td>
      <td>${sku.additionalNotes || "—"}</td>
    </tr>
  `).join("");

  // Advance button (edit mode only, not shown if dispatched)
  const nextStage = STAGES[STAGES.indexOf(order.currentStage) + 1];
  const advanceSection = editMode && nextStage ? `
    <div class="card-actions" id="actions-${order.id}">
      <input
        type="text"
        class="stage-note-input"
        id="note-input-${order.id}"
        placeholder="Stage note (optional)"
      />
      <button class="btn btn-primary btn-sm" onclick="advanceStage('${order.id}')">
        Advance to ${nextStage}
      </button>
    </div>
  ` : "";

  card.innerHTML = `
    <div class="order-card-header">
      <div>
        <p class="order-id">${order.id}</p>
        <p class="order-title">${order.projectName}</p>
        <p class="order-client">${order.clientName}</p>
      </div>
      <span class="stage-badge ${getStageBadgeClass(order.currentStage)}">
        ${order.currentStage}
      </span>
    </div>

    <div class="order-meta">
      <span>Drawing: <strong>${order.drawingRef || "—"}</strong></span>
      <span>Added: ${formatDate(order.dateAdded)}</span>
      <span class="${overdue ? "overdue-flag" : ""}">
        Due: ${formatDate(order.dueDate)}${overdue ? " — OVERDUE" : ""}
      </span>
    </div>

    <table class="sku-table">
      <thead>
        <tr>
          <th>Product</th>
          <th>Qty</th>
          <th>Size</th>
          <th>Thickness</th>
          <th>Material</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>${skuRows}</tbody>
    </table>

    ${currentNote ? `<p class="stage-note">Note: ${currentNote}</p>` : ""}
    ${advanceSection}
  `;

  return card;
}

/* ----------------------------------------------------------
   5. RENDER COMPLETED ORDERS
   ---------------------------------------------------------- */

function renderCompleted() {
  const container = document.getElementById("completed-container");
  const emptyMsg = document.getElementById("completed-empty");
  const completed = orders.filter(o => o.currentStage === "Dispatched");

  // Clear existing completed cards
  container.querySelectorAll(".completed-card").forEach(c => c.remove());

  if (completed.length === 0) {
    emptyMsg.classList.remove("hidden");
    // Hide reset button if no completed orders
    document.getElementById("reset-btn").classList.add("hidden");
  } else {
    emptyMsg.classList.add("hidden");
    if (editMode) document.getElementById("reset-btn").classList.remove("hidden");

    completed.forEach(order => {
      const card = document.createElement("div");
      card.className = "completed-card";
      card.dataset.id = order.id;

      const skuSummary = order.skus.map(s => `${s.quantity} ${s.productType}`).join(", ");

      card.innerHTML = `
        <div class="completed-card-header" onclick="toggleCompleted('${order.id}')">
          <div>
            <span class="order-id">${order.id}</span>
            <span style="margin-left:10px;font-weight:600;">${order.projectName}</span>
            <span style="margin-left:8px;color:var(--text-secondary);font-size:0.82rem;">${order.clientName}</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="stage-badge dispatched">Dispatched</span>
            <span style="font-size:0.8rem;color:var(--text-muted);">&#9660;</span>
          </div>
        </div>
        <div class="completed-card-body" id="completed-body-${order.id}">
          <div class="order-meta" style="margin-top:12px;">
            <span>Drawing: <strong>${order.drawingRef || "—"}</strong></span>
            <span>Added: ${formatDate(order.dateAdded)}</span>
            <span>Due: ${formatDate(order.dueDate)}</span>
          </div>
          <p style="font-size:0.82rem;margin-top:8px;color:var(--text-secondary);">Items: ${skuSummary}</p>
        </div>
      `;

      container.appendChild(card);
    });
  }
}

function toggleCompleted(orderId) {
  const body = document.getElementById(`completed-body-${orderId}`);
  if (body) body.classList.toggle("open");
}

/* ----------------------------------------------------------
   6. ADD ORDER FORM
   ---------------------------------------------------------- */

// Add a blank SKU row to the form
function addSkuRow() {
  const skuList = document.getElementById("sku-list");
  const index = skuList.children.length + 1;

  const productOptions = PRODUCT_TYPES.map(p =>
    `<option value="${p}">${p}</option>`
  ).join("");

  const row = document.createElement("div");
  row.className = "sku-row";
  row.innerHTML = `
    <div class="sku-row-header">
      <span class="sku-row-num">Item ${index}</span>
      <button type="button" class="sku-remove" onclick="removeSkuRow(this)">Remove</button>
    </div>

    <label>Product Type</label>
    <select class="sku-product">${productOptions}</select>

    <div class="sku-inline">
      <div style="flex:1;">
        <label>Quantity</label>
        <input type="number" class="sku-qty" min="1" placeholder="e.g. 3" />
      </div>
      <div style="flex:1;">
        <label>Unit</label>
        <select class="sku-unit">
          <option value="Pieces">Pieces</option>
          <option value="Square Feet">Square Feet</option>
        </select>
      </div>
    </div>

    <label>Size</label>
    <div class="sku-inline">
      <input type="text" class="sku-size" placeholder="e.g. 2100 x 900" style="flex:2;" />
      <select class="sku-size-unit" style="flex:1;">
        <option value="mm">mm</option>
        <option value="M">M</option>
        <option value="ft">ft</option>
      </select>
    </div>

    <label>Thickness (mm)</label>
    <input type="number" class="sku-thickness" min="1" placeholder="e.g. 18" />

    <label>Material</label>
    <input type="text" class="sku-material" placeholder="e.g. Teak Veneer" />

    <label>Additional Notes</label>
    <input type="text" class="sku-notes" placeholder="Optional" />
  `;

  skuList.appendChild(row);
  renumberSkuRows();
}

function removeSkuRow(btn) {
  btn.closest(".sku-row").remove();
  renumberSkuRows();
}

function renumberSkuRows() {
  const rows = document.querySelectorAll(".sku-row");
  rows.forEach((row, i) => {
    const label = row.querySelector(".sku-row-num");
    if (label) label.textContent = `Item ${i + 1}`;
  });
}

// Read all SKU rows from the form
function readSkusFromForm() {
  const rows = document.querySelectorAll(".sku-row");
  const skus = [];
  rows.forEach(row => {
    skus.push({
      productType:     row.querySelector(".sku-product")?.value || "",
      quantity:        Number(row.querySelector(".sku-qty")?.value) || 0,
      unit:            row.querySelector(".sku-unit")?.value || "Pieces",
      size:            row.querySelector(".sku-size")?.value.trim() || "",
      sizeUnit:        row.querySelector(".sku-size-unit")?.value || "mm",
      thickness:       row.querySelector(".sku-thickness")?.value.trim() || "",
      material:        row.querySelector(".sku-material")?.value.trim() || "",
      additionalNotes: row.querySelector(".sku-notes")?.value.trim() || ""
    });
  });
  return skus;
}

// Handle form submission
document.getElementById("order-form").addEventListener("submit", function (e) {
  e.preventDefault();

  const clientName  = document.getElementById("client-name").value.trim();
  const projectName = document.getElementById("project-name").value.trim();
  const drawingRef  = document.getElementById("drawing-ref").value.trim();
  const dueDate     = document.getElementById("due-date").value;

  const formError = document.getElementById("form-error");
  const skuError  = document.getElementById("sku-error");

  // Validation
  let valid = true;

  if (!clientName || !projectName || !dueDate) {
    formError.classList.remove("hidden");
    valid = false;
  } else {
    formError.classList.add("hidden");
  }

  const skus = readSkusFromForm();
  if (skus.length === 0) {
    skuError.classList.remove("hidden");
    valid = false;
  } else {
    skuError.classList.add("hidden");
  }

  if (!valid) return;

  // Build order object
  const today = new Date().toISOString().split("T")[0];
  const newOrder = {
    id:           generateOrderId(),
    clientName,
    projectName,
    drawingRef,
    dueDate,
    currentStage: "Order Received",
    dateAdded:    today,
    skus,
    stageNotes: {
      "Order Received":  "",
      "Material Sourced": "",
      "In Production":   "",
      "Quality Check":   "",
      "Dispatched":      ""
    }
  };

  orders.push(newOrder);
  renderOrders();
  resetForm();
});

function resetForm() {
  document.getElementById("order-form").reset();
  document.getElementById("sku-list").innerHTML = "";
  document.getElementById("form-error").classList.add("hidden");
  document.getElementById("sku-error").classList.add("hidden");
  addSkuRow(); // always start with one blank row
}

/* ----------------------------------------------------------
   7. ADVANCE STAGE
   ---------------------------------------------------------- */

function advanceStage(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  const noteInput = document.getElementById(`note-input-${orderId}`);
  const note = noteInput ? noteInput.value.trim() : "";

  // Save note to current stage before advancing
  if (note) order.stageNotes[order.currentStage] = note;

  const currentIndex = STAGES.indexOf(order.currentStage);
  if (currentIndex < STAGES.length - 1) {
    order.currentStage = STAGES[currentIndex + 1];
  }

  renderOrders();
}

/* ----------------------------------------------------------
   8. FILTER
   ---------------------------------------------------------- */

document.getElementById("filter-stage").addEventListener("change", function () {
  currentFilter = this.value;
  renderOrders();
});

/* ----------------------------------------------------------
   9. RESET (clear completed only)
   ---------------------------------------------------------- */

document.getElementById("reset-btn").addEventListener("click", function () {
  const completed = orders.filter(o => o.currentStage === "Dispatched");
  if (completed.length === 0) return;

  const confirmed = window.confirm(
    `This will remove all ${completed.length} completed order(s). Active orders will not be affected. Continue?`
  );
  if (!confirmed) return;

  orders = orders.filter(o => o.currentStage !== "Dispatched");
  renderOrders();
});

/* ----------------------------------------------------------
   10. EDIT MODE (PIN)
   ---------------------------------------------------------- */

document.getElementById("edit-mode-btn").addEventListener("click", function () {
  if (editMode) {
    // Exit edit mode
    editMode = false;
    this.textContent = "Enter Edit Mode";
    this.classList.remove("btn-primary");
    this.classList.add("btn-outline");
    document.getElementById("order-form").classList.add("hidden");
    document.getElementById("reset-btn").classList.add("hidden");
    renderOrders();
  } else {
    // Show PIN overlay
    document.getElementById("pin-overlay").classList.remove("hidden");
    document.getElementById("pin-input").value = "";
    document.getElementById("pin-error").classList.add("hidden");
    document.getElementById("pin-input").focus();
  }
});

document.getElementById("pin-submit").addEventListener("click", function () {
  const entered = document.getElementById("pin-input").value;
  if (entered === PIN) {
    editMode = true;
    document.getElementById("pin-overlay").classList.add("hidden");
    document.getElementById("edit-mode-btn").textContent = "Exit Edit Mode";
    document.getElementById("edit-mode-btn").classList.remove("btn-outline");
    document.getElementById("edit-mode-btn").classList.add("btn-primary");
    document.getElementById("order-form").classList.remove("hidden");
    // Show reset button only if there are completed orders
    const completed = orders.filter(o => o.currentStage === "Dispatched");
    if (completed.length > 0) {
      document.getElementById("reset-btn").classList.remove("hidden");
    }
    renderOrders();
  } else {
    document.getElementById("pin-error").classList.remove("hidden");
    document.getElementById("pin-input").value = "";
    document.getElementById("pin-input").focus();
  }
});

document.getElementById("pin-cancel").addEventListener("click", function () {
  document.getElementById("pin-overlay").classList.add("hidden");
});

// Allow Enter key in PIN input
document.getElementById("pin-input").addEventListener("keydown", function (e) {
  if (e.key === "Enter") document.getElementById("pin-submit").click();
});

/* ----------------------------------------------------------
   11. SIDEBAR TOGGLE
   ---------------------------------------------------------- */

document.getElementById("sidebar-toggle").addEventListener("click", function () {
  const sidebar = document.getElementById("sidebar");
  const openBtn = document.getElementById("sidebar-open-btn");
  sidebar.classList.add("collapsed");
  openBtn.classList.remove("hidden");
});

document.getElementById("sidebar-open-btn").addEventListener("click", function () {
  const sidebar = document.getElementById("sidebar");
  this.classList.add("hidden");
  sidebar.classList.remove("collapsed");
});

/* ----------------------------------------------------------
   12. LOAD SAMPLE DATA
   ---------------------------------------------------------- */

function loadSampleData() {
  const today = new Date().toISOString().split("T")[0];
  const pastDate = "2026-06-20";
  const futureDate = "2026-07-15";
  const soonDate = "2026-06-28";

  const samples = [
    {
      id: "SF-20JUN-001",
      clientName: "Mehra Enterprises",
      projectName: "Corporate Office — Gurgaon",
      drawingRef: "DWG-2026-012",
      dueDate: pastDate,
      currentStage: "In Production",
      dateAdded: "2026-06-15",
      skus: [
        { productType: "Doors", quantity: 12, unit: "Pieces", size: "2100 x 900", sizeUnit: "mm", thickness: "32", material: "Walnut Veneer", additionalNotes: "Flush finish" },
        { productType: "Wall Panels", quantity: 240, unit: "Square Feet", size: "2400 x 1200", sizeUnit: "mm", thickness: "18", material: "Oak Veneer", additionalNotes: "" }
      ],
      stageNotes: {
        "Order Received": "PO confirmed by client on 15 Jun",
        "Material Sourced": "Walnut and Oak veneer received from Delhi supplier",
        "In Production": "",
        "Quality Check": "",
        "Dispatched": ""
      }
    },
    {
      id: "SF-22JUN-002",
      clientName: "Sharma Family",
      projectName: "Ireo Ascott — Master Bedroom",
      drawingRef: "DWG-2026-019",
      dueDate: soonDate,
      currentStage: "Material Sourced",
      dateAdded: "2026-06-22",
      skus: [
        { productType: "Wardrobe", quantity: 2, unit: "Pieces", size: "2400 x 600", sizeUnit: "mm", thickness: "18", material: "White Laminate", additionalNotes: "Soft close hinges" },
        { productType: "Kitchen Shutters", quantity: 18, unit: "Pieces", size: "600 x 450", sizeUnit: "mm", thickness: "12", material: "Acrylic Gloss", additionalNotes: "Handle-less profile" }
      ],
      stageNotes: {
        "Order Received": "Rush order — client requested 28 Jun delivery",
        "Material Sourced": "Acrylic panels sourced from Noida",
        "In Production": "",
        "Quality Check": "",
        "Dispatched": ""
      }
    },
    {
      id: "SF-23JUN-003",
      clientName: "Kapoor & Associates",
      projectName: "DLF Cyber City — Boardroom",
      drawingRef: "DWG-2026-024",
      dueDate: futureDate,
      currentStage: "Order Received",
      dateAdded: "2026-06-23",
      skus: [
        { productType: "Wall Panels", quantity: 320, unit: "Square Feet", size: "2700 x 1200", sizeUnit: "mm", thickness: "18", material: "Veneer — Dark Wenge", additionalNotes: "" }
      ],
      stageNotes: {
        "Order Received": "",
        "Material Sourced": "",
        "In Production": "",
        "Quality Check": "",
        "Dispatched": ""
      }
    },
    {
      id: "SF-24JUN-004",
      clientName: "Patel Residence",
      projectName: "Golf Links — Living Room",
      drawingRef: "DWG-2026-028",
      dueDate: futureDate,
      currentStage: "Quality Check",
      dateAdded: "2026-06-24",
      skus: [
        { productType: "Loose Furniture", quantity: 4, unit: "Pieces", size: "900 x 450", sizeUnit: "mm", thickness: "25", material: "Solid Teak", additionalNotes: "Oiled finish" },
        { productType: "Flooring", quantity: 180, unit: "Square Feet", size: "600 x 100", sizeUnit: "mm", thickness: "12", material: "Engineered Wood", additionalNotes: "Herringbone pattern" }
      ],
      stageNotes: {
        "Order Received": "All drawings signed off",
        "Material Sourced": "Teak sourced from Kerala supplier",
        "In Production": "Flooring completed ahead of schedule",
        "Quality Check": "",
        "Dispatched": ""
      }
    },
    {
      id: "SF-18JUN-001",
      clientName: "Anand Constructions",
      projectName: "Sector 62 — Show Apartment",
      drawingRef: "DWG-2026-007",
      dueDate: "2026-06-20",
      currentStage: "Dispatched",
      dateAdded: "2026-06-10",
      skus: [
        { productType: "Kitchen Shutters", quantity: 24, unit: "Pieces", size: "600 x 500", sizeUnit: "mm", thickness: "12", material: "PU Gloss White", additionalNotes: "" }
      ],
      stageNotes: {
        "Order Received": "Standard show apartment spec",
        "Material Sourced": "PU lacquer panels in stock",
        "In Production": "Completed in 6 days",
        "Quality Check": "All pieces passed inspection",
        "Dispatched": "Delivered and installed on site"
      }
    },
    {
      id: "SF-19JUN-002",
      clientName: "Verma Family",
      projectName: "Vasant Vihar — Study Room",
      drawingRef: "DWG-2026-009",
      dueDate: "2026-06-22",
      currentStage: "Dispatched",
      dateAdded: "2026-06-12",
      skus: [
        { productType: "Wardrobe", quantity: 1, unit: "Pieces", size: "2100 x 600", sizeUnit: "mm", thickness: "18", material: "Linen Texture Laminate", additionalNotes: "Open shelf section" },
        { productType: "Loose Furniture", quantity: 1, unit: "Pieces", size: "1200 x 600", sizeUnit: "mm", thickness: "25", material: "Solid Sheesham", additionalNotes: "Study table with cable management" }
      ],
      stageNotes: {
        "Order Received": "Client approved drawings on 12 Jun",
        "Material Sourced": "Sheesham sourced locally",
        "In Production": "Completed on schedule",
        "Quality Check": "Minor touch-up on wardrobe edge done",
        "Dispatched": "Delivered 22 Jun, client satisfied"
      }
    }
  ];

  // Merge without duplicating IDs
  const existingIds = orders.map(o => o.id);
  samples.forEach(s => {
    if (!existingIds.includes(s.id)) {
      orders.push(s);
      // Keep counter accurate
      orderCounter++;
    }
  });

  renderOrders();
}

document.getElementById("load-sample-btn").addEventListener("click", loadSampleData);
document.getElementById("empty-load-sample").addEventListener("click", loadSampleData);

/* ----------------------------------------------------------
   13. INIT
   ---------------------------------------------------------- */

function init() {
  // Start form hidden until edit mode
  document.getElementById("order-form").classList.add("hidden");
  // Add one blank SKU row ready for when edit mode is entered
  addSkuRow();
  // Initial render
  renderOrders();
}

document.getElementById("add-sku-btn").addEventListener("click", addSkuRow);

init();
