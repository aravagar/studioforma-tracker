/* ============================================================
   STUDIOFORMA PRODUCTION TRACKER — app.js
   Iteration 2: Core Functionality Complete
   ============================================================ */

/* ----------------------------------------------------------
   1. CONSTANTS & STATE
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

let orders = [];
let editMode = false;
let orderCounter = 0;
let currentFilter = "All";
let pendingResetConfirm = false; // tracks inline confirm state

/* ----------------------------------------------------------
   2. UTILITIES
   ---------------------------------------------------------- */

function generateOrderId() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const months = ["JAN","FEB","MAR","APR","MAY","JUN",
                   "JUL","AUG","SEP","OCT","NOV","DEC"];
  const mon = months[now.getMonth()];
  orderCounter++;
  return `SF-${day}${mon}-${String(orderCounter).padStart(3, "0")}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun",
                  "Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d} ${months[Number(m) - 1]} ${y}`;
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function isOverdue(order) {
  if (!order.dueDate || order.currentStage === "Dispatched") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(order.dueDate) < today;
}

function getStageBadgeClass(stage) {
  return {
    "Order Received":  "received",
    "Material Sourced":"material",
    "In Production":   "production",
    "Quality Check":   "qc",
    "Dispatched":      "dispatched"
  }[stage] || "";
}

function stageProgressHTML(currentStage) {
  const activeIndex = STAGES.indexOf(currentStage);
  return STAGES.slice(0, -1).map((_, i) => {
    const cls = i < activeIndex ? "done" : i === activeIndex ? "active" : "";
    return `<div class="stage-pip ${cls}" title="${STAGES[i]}"></div>`;
  }).join("");
}

/* ----------------------------------------------------------
   3. DASHBOARD
   ---------------------------------------------------------- */

function updateDashboard() {
  const active = orders.filter(o => o.currentStage !== "Dispatched");

  const counts = {
    total:      active.length,
    received:   active.filter(o => o.currentStage === "Order Received").length,
    material:   active.filter(o => o.currentStage === "Material Sourced").length,
    production: active.filter(o => o.currentStage === "In Production").length,
    qc:         active.filter(o => o.currentStage === "Quality Check").length,
  };

  const ids = ["total","received","material","production","qc"];
  ids.forEach(id => {
    const el = document.getElementById(`count-${id}`);
    const newVal = String(counts[id]);
    if (el && el.textContent !== newVal) {
      el.textContent = newVal;
      el.classList.remove("bump");
      void el.offsetWidth; // reflow to restart animation
      el.classList.add("bump");
    }
  });
}

/* ----------------------------------------------------------
   4. RENDER ORDERS
   ---------------------------------------------------------- */

function renderOrders() {
  const container = document.getElementById("orders-container");
  const emptyState = document.getElementById("empty-state");

  const activeOrders = orders.filter(o => o.currentStage !== "Dispatched");
  const filtered = currentFilter === "All"
    ? activeOrders
    : activeOrders.filter(o => o.currentStage === currentFilter);

  // Remove existing cards and filter-empty notices
  container.querySelectorAll(".order-card, .filter-empty").forEach(el => el.remove());

  if (activeOrders.length === 0) {
    emptyState.classList.remove("hidden");
  } else {
    emptyState.classList.add("hidden");

    if (filtered.length === 0) {
      // Stage filter has no results
      const msg = document.createElement("p");
      msg.className = "filter-empty";
      msg.textContent = `No orders currently at "${currentFilter}".`;
      container.appendChild(msg);
    } else {
      filtered.forEach(order => container.appendChild(buildOrderCard(order)));
    }
  }

  renderCompleted();
  updateDashboard();
  updateResetBtn();
}

function buildOrderCard(order, flash = false) {
  const overdue = isOverdue(order);
  const card = document.createElement("article");
  card.className = "order-card" + (overdue ? " overdue" : "") + (flash ? " card-flash" : "");
  card.dataset.id = order.id;

  const currentNote = order.stageNotes[order.currentStage] || "";
  const nextStage = STAGES[STAGES.indexOf(order.currentStage) + 1];

  // SKU rows
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

  // Advance section — only in edit mode and only if not final stage
  const advanceSection = editMode && nextStage ? `
    <div class="card-actions" id="actions-${order.id}">
      <input
        type="text"
        class="stage-note-input"
        id="note-input-${order.id}"
        placeholder="Stage note (optional)"
      />
      <button
        class="btn btn-primary btn-sm"
        onclick="advanceStage('${order.id}')">
        Move to ${nextStage}
      </button>
    </div>
  ` : "";

  card.innerHTML = `
    <div class="order-card-header">
      <div>
        <p class="order-id">${order.id}</p>
        <p class="order-title">${escapeHTML(order.projectName)}</p>
        <p class="order-client">${escapeHTML(order.clientName)}</p>
      </div>
      <span class="stage-badge ${getStageBadgeClass(order.currentStage)}">
        ${order.currentStage}
      </span>
    </div>

    <div class="stage-progress" title="Production stage progress">
      ${stageProgressHTML(order.currentStage)}
    </div>

    <div class="order-meta">
      <span>Drawing: <strong>${escapeHTML(order.drawingRef || "—")}</strong></span>
      <span>Added: ${formatDate(order.dateAdded)}</span>
      <span class="${overdue ? "overdue-flag" : ""}">
        Due: ${formatDate(order.dueDate)}${overdue ? " — OVERDUE" : ""}
      </span>
    </div>

    <table class="sku-table">
      <thead>
        <tr>
          <th>Product</th><th>Qty</th><th>Size</th>
          <th>Thickness</th><th>Material</th><th>Notes</th>
        </tr>
      </thead>
      <tbody>${skuRows}</tbody>
    </table>

    ${currentNote ? `<p class="stage-note">&#128221; ${escapeHTML(currentNote)}</p>` : ""}
    ${advanceSection}
  `;

  return card;
}

/* ----------------------------------------------------------
   5. RENDER COMPLETED
   ---------------------------------------------------------- */

function renderCompleted() {
  const container = document.getElementById("completed-container");
  const emptyMsg = document.getElementById("completed-empty");
  const completed = orders.filter(o => o.currentStage === "Dispatched");

  container.querySelectorAll(".completed-card").forEach(c => c.remove());

  if (completed.length === 0) {
    emptyMsg.classList.remove("hidden");
  } else {
    emptyMsg.classList.add("hidden");
    completed.forEach(order => {
      const card = buildCompletedCard(order);
      container.appendChild(card);
    });
  }
}

function buildCompletedCard(order) {
  const card = document.createElement("div");
  card.className = "completed-card";
  card.dataset.id = order.id;

  const skuSummary = order.skus.map(s => `${s.quantity} ${s.productType}`).join(", ");

  // All stage notes that have content
  const noteRows = STAGES.map(stage => {
    const note = order.stageNotes[stage];
    if (!note) return "";
    return `
      <div class="completed-stage-note-row">
        <span class="completed-stage-note-label">${stage}:</span>
        <span>${escapeHTML(note)}</span>
      </div>
    `;
  }).join("");

  card.innerHTML = `
    <div class="completed-card-header" onclick="toggleCompleted('${order.id}')">
      <div>
        <span class="order-id">${order.id}</span>
        <span style="margin-left:10px;font-weight:600;">${escapeHTML(order.projectName)}</span>
        <span style="margin-left:8px;color:var(--text-secondary);font-size:0.82rem;">
          ${escapeHTML(order.clientName)}
        </span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="stage-badge dispatched">Dispatched</span>
        <span class="completed-chevron" id="chevron-${order.id}">&#9660;</span>
      </div>
    </div>
    <div class="completed-card-body" id="completed-body-${order.id}">
      <div class="order-meta" style="margin-top:12px;">
        <span>Drawing: <strong>${escapeHTML(order.drawingRef || "—")}</strong></span>
        <span>Added: ${formatDate(order.dateAdded)}</span>
        <span>Due: ${formatDate(order.dueDate)}</span>
      </div>
      <p style="font-size:0.82rem;margin-top:8px;color:var(--text-secondary);">
        Items: ${escapeHTML(skuSummary)}
      </p>
      ${noteRows ? `<div class="completed-stage-notes">${noteRows}</div>` : ""}
    </div>
  `;

  return card;
}

function toggleCompleted(orderId) {
  const body = document.getElementById(`completed-body-${orderId}`);
  const chevron = document.getElementById(`chevron-${orderId}`);
  if (body) body.classList.toggle("open");
  if (chevron) chevron.classList.toggle("open");
}

/* ----------------------------------------------------------
   6. XSS PROTECTION
   ---------------------------------------------------------- */

function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ----------------------------------------------------------
   7. ADD ORDER FORM
   ---------------------------------------------------------- */

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
        <label>Quantity <span class="required">*</span></label>
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
  document.querySelectorAll(".sku-row").forEach((row, i) => {
    const label = row.querySelector(".sku-row-num");
    if (label) label.textContent = `Item ${i + 1}`;
  });
}

function readSkusFromForm() {
  return Array.from(document.querySelectorAll(".sku-row")).map(row => ({
    productType:     row.querySelector(".sku-product")?.value || "",
    quantity:        Number(row.querySelector(".sku-qty")?.value) || 0,
    unit:            row.querySelector(".sku-unit")?.value || "Pieces",
    size:            row.querySelector(".sku-size")?.value.trim() || "",
    sizeUnit:        row.querySelector(".sku-size-unit")?.value || "mm",
    thickness:       row.querySelector(".sku-thickness")?.value.trim() || "",
    material:        row.querySelector(".sku-material")?.value.trim() || "",
    additionalNotes: row.querySelector(".sku-notes")?.value.trim() || ""
  }));
}

// Validate a single required input, show/hide error class
function validateField(el, condition) {
  if (condition) {
    el.classList.remove("input-error");
    return true;
  } else {
    el.classList.add("input-error");
    return false;
  }
}

document.getElementById("order-form").addEventListener("submit", function (e) {
  e.preventDefault();

  const clientEl  = document.getElementById("client-name");
  const projectEl = document.getElementById("project-name");
  const dueDateEl = document.getElementById("due-date");
  const formError = document.getElementById("form-error");
  const skuError  = document.getElementById("sku-error");

  // Per-field validation with red border feedback
  const clientOk  = validateField(clientEl,  clientEl.value.trim() !== "");
  const projectOk = validateField(projectEl, projectEl.value.trim() !== "");
  const dateOk    = validateField(dueDateEl, dueDateEl.value !== "");

  if (!clientOk || !projectOk || !dateOk) {
    formError.classList.remove("hidden");
  } else {
    formError.classList.add("hidden");
  }

  const skus = readSkusFromForm();
  // Validate each SKU has a quantity
  let skusOk = skus.length > 0;
  skus.forEach((sku, i) => {
    const row = document.querySelectorAll(".sku-row")[i];
    const qtyEl = row?.querySelector(".sku-qty");
    if (!sku.quantity || sku.quantity < 1) {
      if (qtyEl) qtyEl.classList.add("input-error");
      skusOk = false;
    } else {
      if (qtyEl) qtyEl.classList.remove("input-error");
    }
  });

  if (skus.length === 0) {
    skuError.textContent = "Add at least one item before submitting.";
    skuError.classList.remove("hidden");
    skusOk = false;
  } else if (!skusOk) {
    skuError.textContent = "Each item needs a quantity greater than 0.";
    skuError.classList.remove("hidden");
  } else {
    skuError.classList.add("hidden");
  }

  if (!clientOk || !projectOk || !dateOk || !skusOk) return;

  // Build and push new order
  const newOrder = {
    id:           generateOrderId(),
    clientName:   clientEl.value.trim(),
    projectName:  projectEl.value.trim(),
    drawingRef:   document.getElementById("drawing-ref").value.trim(),
    dueDate:      dueDateEl.value,
    currentStage: "Order Received",
    dateAdded:    todayStr(),
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
  resetForm();
  renderOrders();

  // Flash the new card
  const newCard = document.querySelector(`.order-card[data-id="${newOrder.id}"]`);
  if (newCard) {
    newCard.classList.add("card-flash");
    newCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    newCard.addEventListener("animationend", () => newCard.classList.remove("card-flash"), { once: true });
  }
});

// Clear input-error class on user input
["client-name","project-name","due-date"].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("input", () => el.classList.remove("input-error"));
});

function resetForm() {
  document.getElementById("order-form").reset();
  document.getElementById("sku-list").innerHTML = "";
  document.getElementById("form-error").classList.add("hidden");
  document.getElementById("sku-error").classList.add("hidden");
  // Always start with one blank SKU row
  addSkuRow();
}

/* ----------------------------------------------------------
   8. ADVANCE STAGE
   ---------------------------------------------------------- */

function advanceStage(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  const noteInput = document.getElementById(`note-input-${orderId}`);
  const note = noteInput ? noteInput.value.trim() : "";
  if (note) order.stageNotes[order.currentStage] = note;

  const currentIndex = STAGES.indexOf(order.currentStage);
  if (currentIndex < STAGES.length - 1) {
    order.currentStage = STAGES[currentIndex + 1];
  }

  renderOrders();
}

/* ----------------------------------------------------------
   9. FILTER
   ---------------------------------------------------------- */

document.getElementById("filter-stage").addEventListener("change", function () {
  currentFilter = this.value;
  renderOrders();
});

/* ----------------------------------------------------------
   10. RESET — inline confirm (no window.confirm)
   ---------------------------------------------------------- */

function updateResetBtn() {
  const btn = document.getElementById("reset-btn");
  const completed = orders.filter(o => o.currentStage === "Dispatched");
  if (editMode && completed.length > 0) {
    btn.classList.remove("hidden");
  } else {
    btn.classList.add("hidden");
    // Also cancel any pending confirm
    cancelResetConfirm();
  }
}

function cancelResetConfirm() {
  pendingResetConfirm = false;
  const existing = document.getElementById("reset-confirm-box");
  if (existing) existing.remove();
  const btn = document.getElementById("reset-btn");
  if (btn) btn.textContent = "Clear Completed";
}

document.getElementById("reset-btn").addEventListener("click", function () {
  if (pendingResetConfirm) {
    // Second click — execute
    cancelResetConfirm();
    orders = orders.filter(o => o.currentStage !== "Dispatched");
    renderOrders();
    return;
  }

  // First click — show inline confirm
  pendingResetConfirm = true;
  this.textContent = "Confirm Clear";

  const confirmBox = document.createElement("div");
  confirmBox.className = "inline-confirm";
  confirmBox.id = "reset-confirm-box";
  confirmBox.innerHTML = `
    <span>This removes all completed orders. Active orders are not affected.</span>
    <button class="btn btn-danger btn-sm" onclick="document.getElementById('reset-btn').click()">Yes, clear</button>
    <button class="btn btn-ghost btn-sm" onclick="cancelResetConfirm()">Cancel</button>
  `;

  const controlsRight = document.querySelector(".board-controls-right");
  controlsRight.insertAdjacentElement("afterend", confirmBox);
});

/* ----------------------------------------------------------
   11. EDIT MODE (PIN)
   ---------------------------------------------------------- */

document.getElementById("edit-mode-btn").addEventListener("click", function () {
  if (editMode) {
    exitEditMode();
  } else {
    document.getElementById("pin-overlay").classList.remove("hidden");
    document.getElementById("pin-input").value = "";
    document.getElementById("pin-error").classList.add("hidden");
    setTimeout(() => document.getElementById("pin-input").focus(), 50);
  }
});

function enterEditMode() {
  editMode = true;
  document.getElementById("pin-overlay").classList.add("hidden");

  const btn = document.getElementById("edit-mode-btn");
  btn.textContent = "Exit Edit Mode";
  btn.classList.remove("btn-outline");
  btn.classList.add("btn-primary");

  // Show edit mode indicator
  const indicator = document.getElementById("edit-indicator");
  if (indicator) indicator.classList.remove("hidden");

  // Show form, hide locked message
  document.getElementById("order-form").classList.remove("hidden");
  const lockedMsg = document.getElementById("sidebar-locked-msg");
  if (lockedMsg) lockedMsg.classList.add("hidden");

  renderOrders();
}

function exitEditMode() {
  editMode = false;
  cancelResetConfirm();

  const btn = document.getElementById("edit-mode-btn");
  btn.textContent = "Enter Edit Mode";
  btn.classList.remove("btn-primary");
  btn.classList.add("btn-outline");

  // Hide edit mode indicator
  const indicator = document.getElementById("edit-indicator");
  if (indicator) indicator.classList.add("hidden");

  // Hide form, show locked message
  document.getElementById("order-form").classList.add("hidden");
  const lockedMsg = document.getElementById("sidebar-locked-msg");
  if (lockedMsg) lockedMsg.classList.remove("hidden");

  renderOrders();
}

document.getElementById("pin-submit").addEventListener("click", function () {
  const entered = document.getElementById("pin-input").value;
  if (entered === PIN) {
    enterEditMode();
  } else {
    const err = document.getElementById("pin-error");
    err.classList.remove("hidden");
    document.getElementById("pin-input").value = "";
    document.getElementById("pin-input").focus();
  }
});

document.getElementById("pin-cancel").addEventListener("click", () => {
  document.getElementById("pin-overlay").classList.add("hidden");
});

document.getElementById("pin-input").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("pin-submit").click();
});

// Close overlay on backdrop click
document.getElementById("pin-overlay").addEventListener("click", function (e) {
  if (e.target === this) document.getElementById("pin-overlay").classList.add("hidden");
});

/* ----------------------------------------------------------
   12. SIDEBAR TOGGLE
   ---------------------------------------------------------- */

document.getElementById("sidebar-toggle").addEventListener("click", function () {
  document.getElementById("sidebar").classList.add("collapsed");
  document.getElementById("sidebar-open-btn").classList.remove("hidden");
});

document.getElementById("sidebar-open-btn").addEventListener("click", function () {
  this.classList.add("hidden");
  document.getElementById("sidebar").classList.remove("collapsed");
});

/* ----------------------------------------------------------
   13. LOAD SAMPLE DATA
   ---------------------------------------------------------- */

function loadSampleData() {
  const samples = [
    {
      id: "SF-20JUN-001",
      clientName: "Mehra Enterprises",
      projectName: "Corporate Office — Gurgaon",
      drawingRef: "DWG-2026-012",
      dueDate: "2026-06-20",
      currentStage: "In Production",
      dateAdded: "2026-06-15",
      skus: [
        { productType: "Doors", quantity: 12, unit: "Pieces", size: "2100 x 900", sizeUnit: "mm", thickness: "32", material: "Walnut Veneer", additionalNotes: "Flush finish" },
        { productType: "Wall Panels", quantity: 240, unit: "Square Feet", size: "2400 x 1200", sizeUnit: "mm", thickness: "18", material: "Oak Veneer", additionalNotes: "" }
      ],
      stageNotes: {
        "Order Received":  "PO confirmed by client on 15 Jun",
        "Material Sourced":"Walnut and Oak veneer received from Delhi supplier",
        "In Production":   "",
        "Quality Check":   "",
        "Dispatched":      ""
      }
    },
    {
      id: "SF-22JUN-002",
      clientName: "Sharma Family",
      projectName: "Ireo Ascott — Master Bedroom",
      drawingRef: "DWG-2026-019",
      dueDate: "2026-06-28",
      currentStage: "Material Sourced",
      dateAdded: "2026-06-22",
      skus: [
        { productType: "Wardrobe", quantity: 2, unit: "Pieces", size: "2400 x 600", sizeUnit: "mm", thickness: "18", material: "White Laminate", additionalNotes: "Soft close hinges" },
        { productType: "Kitchen Shutters", quantity: 18, unit: "Pieces", size: "600 x 450", sizeUnit: "mm", thickness: "12", material: "Acrylic Gloss", additionalNotes: "Handle-less profile" }
      ],
      stageNotes: {
        "Order Received":  "Rush order — client requested 28 Jun delivery",
        "Material Sourced":"Acrylic panels sourced from Noida",
        "In Production":   "",
        "Quality Check":   "",
        "Dispatched":      ""
      }
    },
    {
      id: "SF-23JUN-003",
      clientName: "Kapoor & Associates",
      projectName: "DLF Cyber City — Boardroom",
      drawingRef: "DWG-2026-024",
      dueDate: "2026-07-15",
      currentStage: "Order Received",
      dateAdded: "2026-06-23",
      skus: [
        { productType: "Wall Panels", quantity: 320, unit: "Square Feet", size: "2700 x 1200", sizeUnit: "mm", thickness: "18", material: "Veneer — Dark Wenge", additionalNotes: "" }
      ],
      stageNotes: {
        "Order Received":  "",
        "Material Sourced":"",
        "In Production":   "",
        "Quality Check":   "",
        "Dispatched":      ""
      }
    },
    {
      id: "SF-24JUN-004",
      clientName: "Patel Residence",
      projectName: "Golf Links — Living Room",
      drawingRef: "DWG-2026-028",
      dueDate: "2026-07-15",
      currentStage: "Quality Check",
      dateAdded: "2026-06-24",
      skus: [
        { productType: "Loose Furniture", quantity: 4, unit: "Pieces", size: "900 x 450", sizeUnit: "mm", thickness: "25", material: "Solid Teak", additionalNotes: "Oiled finish" },
        { productType: "Flooring", quantity: 180, unit: "Square Feet", size: "600 x 100", sizeUnit: "mm", thickness: "12", material: "Engineered Wood", additionalNotes: "Herringbone pattern" }
      ],
      stageNotes: {
        "Order Received":  "All drawings signed off",
        "Material Sourced":"Teak sourced from Kerala supplier",
        "In Production":   "Flooring completed ahead of schedule",
        "Quality Check":   "",
        "Dispatched":      ""
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
        "Order Received":  "Standard show apartment spec",
        "Material Sourced":"PU lacquer panels in stock",
        "In Production":   "Completed in 6 days",
        "Quality Check":   "All pieces passed inspection",
        "Dispatched":      "Delivered and installed on site"
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
        "Order Received":  "Client approved drawings on 12 Jun",
        "Material Sourced":"Sheesham sourced locally",
        "In Production":   "Completed on schedule",
        "Quality Check":   "Minor touch-up on wardrobe edge done",
        "Dispatched":      "Delivered 22 Jun, client satisfied"
      }
    }
  ];

  const existingIds = new Set(orders.map(o => o.id));
  samples.forEach(s => {
    if (!existingIds.has(s.id)) {
      orders.push(s);
      orderCounter++;
    }
  });

  renderOrders();
}

document.getElementById("load-sample-btn").addEventListener("click", loadSampleData);
document.getElementById("empty-load-sample").addEventListener("click", loadSampleData);
document.getElementById("add-sku-btn").addEventListener("click", addSkuRow);

/* ----------------------------------------------------------
   14. INIT
   ---------------------------------------------------------- */

function init() {
  // Form hidden until edit mode — but do NOT add a SKU row yet
  // (row is added when edit mode is entered so it doesn't exist invisibly)
  document.getElementById("order-form").classList.add("hidden");

  // Show locked message in sidebar
  const lockedMsg = document.getElementById("sidebar-locked-msg");
  if (lockedMsg) lockedMsg.classList.remove("hidden");

  renderOrders();
}

init();
