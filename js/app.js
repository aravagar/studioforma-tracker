/* ============================================================
   STUDIOFORMA PRODUCTION TRACKER — app.js
   Iteration 3: Sub-stages, localStorage, Polish, Edge Cases
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

const SUB_STAGES = ["Carpentry", "Painting", "Finishing"];

const PRODUCT_TYPES = [
  "Doors", "Wall Panels", "Kitchen Shutters",
  "Wardrobe", "Flooring", "Loose Furniture", "Other"
];

const PIN = "SF2026";
const STORAGE_KEY = "sf-tracker-orders";
const COUNTER_KEY = "sf-tracker-counter";

let orders = [];
let editMode = false;
let orderCounter = 0;
let currentFilter = "All";
let pendingResetConfirm = false;
let advanceLock = new Set(); // prevents rapid-click double advance

/* ----------------------------------------------------------
   2. LOCAL STORAGE
   ---------------------------------------------------------- */

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    localStorage.setItem(COUNTER_KEY, String(orderCounter));
  } catch (e) {
    console.warn("localStorage save failed:", e);
  }
}

function loadFromStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const savedCounter = localStorage.getItem(COUNTER_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Validate it's an array before trusting it
      if (Array.isArray(parsed)) {
        orders = parsed;
      }
    }
    if (savedCounter) {
      orderCounter = parseInt(savedCounter, 10) || 0;
    }
  } catch (e) {
    console.warn("localStorage load failed — starting fresh:", e);
    orders = [];
    orderCounter = 0;
  }
}

/* ----------------------------------------------------------
   3. UTILITIES
   ---------------------------------------------------------- */

function generateOrderId() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const months = ["JAN","FEB","MAR","APR","MAY","JUN",
                   "JUL","AUG","SEP","OCT","NOV","DEC"];
  orderCounter++;
  saveToStorage();
  return `SF-${day}${months[now.getMonth()]}-${String(orderCounter).padStart(3, "0")}`;
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

function getSubBadgeClass(sub) {
  return { "Carpentry": "carpentry", "Painting": "painting", "Finishing": "finishing" }[sub] || "";
}

function stageProgressHTML(currentStage) {
  const activeIndex = STAGES.indexOf(currentStage);
  return STAGES.slice(0, -1).map((_, i) => {
    const cls = i < activeIndex ? "done" : i === activeIndex ? "active" : "";
    return `<div class="stage-pip ${cls}" title="${STAGES[i]}"></div>`;
  }).join("");
}

function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ----------------------------------------------------------
   4. DASHBOARD
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
  Object.entries(counts).forEach(([id, val]) => {
    const el = document.getElementById(`count-${id}`);
    if (el && el.textContent !== String(val)) {
      el.textContent = val;
      el.classList.remove("bump");
      void el.offsetWidth;
      el.classList.add("bump");
    }
  });
}

/* ----------------------------------------------------------
   5. RENDER ORDERS
   ---------------------------------------------------------- */

function renderOrders() {
  const container = document.getElementById("orders-container");
  const emptyState = document.getElementById("empty-state");

  const activeOrders = orders.filter(o => o.currentStage !== "Dispatched");
  const filtered = currentFilter === "All"
    ? activeOrders
    : activeOrders.filter(o => o.currentStage === currentFilter);

  container.querySelectorAll(".order-card, .filter-empty").forEach(el => el.remove());

  if (activeOrders.length === 0) {
    emptyState.classList.remove("hidden");
  } else {
    emptyState.classList.add("hidden");
    if (filtered.length === 0) {
      const msg = document.createElement("p");
      msg.className = "filter-empty";
      msg.textContent = `No orders currently at "${currentFilter}". Try a different filter.`;
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
  const isInProduction = order.currentStage === "In Production";

  // Sub-stage section (only when In Production)
  const subStageHTML = isInProduction ? buildSubStageHTML(order) : "";

  // Advance stage section
  let advanceHTML = "";
  if (editMode && nextStage && !isInProduction) {
    advanceHTML = `
      <div class="card-actions" id="actions-${order.id}">
        <input type="text" class="stage-note-input" id="note-input-${order.id}"
          placeholder="Stage note (optional)" maxlength="200" />
        <button class="btn btn-primary btn-sm"
          onclick="advanceStage('${order.id}')"
          id="advance-btn-${order.id}">
          Move to ${nextStage}
        </button>
      </div>`;
  } else if (editMode && nextStage && isInProduction) {
    // In production: advance only enabled once sub-stage is Finishing
    const canAdvance = order.subStage === "Finishing";
    advanceHTML = `
      <div class="card-actions" id="actions-${order.id}">
        <input type="text" class="stage-note-input" id="note-input-${order.id}"
          placeholder="Stage note (optional)" maxlength="200"
          ${!canAdvance ? "disabled title='Complete Finishing before advancing'" : ""} />
        <button class="btn btn-primary btn-sm"
          onclick="advanceStage('${order.id}')"
          id="advance-btn-${order.id}"
          ${!canAdvance ? "disabled title='Complete Finishing sub-stage first'" : ""}>
          Move to Quality Check
        </button>
      </div>`;
  }

  // SKU rows
  const skuRows = order.skus.map(sku => `
    <tr>
      <td>${escapeHTML(sku.productType)}</td>
      <td>${sku.quantity} ${escapeHTML(sku.unit)}</td>
      <td>${sku.size ? escapeHTML(sku.size) + " " + escapeHTML(sku.sizeUnit) : "—"}</td>
      <td>${sku.thickness ? escapeHTML(sku.thickness) + " mm" : "—"}</td>
      <td>${escapeHTML(sku.material) || "—"}</td>
      <td>${escapeHTML(sku.additionalNotes) || "—"}</td>
    </tr>`).join("");

  card.innerHTML = `
    <div class="order-card-header">
      <div style="flex:1;min-width:0;">
        <p class="order-id">${escapeHTML(order.id)}</p>
        <p class="order-title">${escapeHTML(order.projectName)}</p>
        <p class="order-client">${escapeHTML(order.clientName)}</p>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;">
        <span class="stage-badge ${getStageBadgeClass(order.currentStage)}">
          ${order.currentStage}
        </span>
        ${isInProduction && order.subStage
          ? `<span class="sub-badge ${getSubBadgeClass(order.subStage)}">${order.subStage}</span>`
          : ""}
      </div>
    </div>

    <div class="stage-progress" title="Production progress">
      ${stageProgressHTML(order.currentStage)}
    </div>

    <div class="order-meta">
      <span>Drawing: <strong>${escapeHTML(order.drawingRef || "—")}</strong></span>
      <span>Added: ${formatDate(order.dateAdded)}</span>
      <span class="${overdue ? "overdue-flag" : ""}">
        Due: ${formatDate(order.dueDate)}${overdue ? " — OVERDUE" : ""}
      </span>
    </div>

    <div class="sku-table-wrap">
      <table class="sku-table">
        <thead>
          <tr>
            <th>Product</th><th>Qty</th><th>Size</th>
            <th>Thickness</th><th>Material</th><th>Notes</th>
          </tr>
        </thead>
        <tbody>${skuRows}</tbody>
      </table>
    </div>

    ${currentNote ? `<p class="stage-note">&#128221; ${escapeHTML(currentNote)}</p>` : ""}
    ${subStageHTML}
    ${advanceHTML}
  `;

  return card;
}

/* ----------------------------------------------------------
   6. SUB-STAGE (In Production: Carpentry → Painting → Finishing)
   ---------------------------------------------------------- */

function buildSubStageHTML(order) {
  const current = order.subStage || "Carpentry";
  const currentIndex = SUB_STAGES.indexOf(current);

  const steps = SUB_STAGES.map((step, i) => {
    const isDone   = i < currentIndex;
    const isActive = i === currentIndex;
    const cls = isDone ? "done" : isActive ? "active" : "";
    return `<div class="sub-stage-step ${cls}">${step}</div>`;
  }).join("");

  const nextSub = SUB_STAGES[currentIndex + 1];
  const advanceSubBtn = editMode && nextSub
    ? `<button class="btn btn-outline btn-sm"
         onclick="advanceSubStage('${order.id}')"
         id="sub-advance-btn-${order.id}">
         Next: ${nextSub}
       </button>`
    : "";

  const subNoteInput = editMode && nextSub
    ? `<input type="text" class="stage-note-input"
         id="sub-note-input-${order.id}"
         placeholder="Sub-stage note (optional)"
         maxlength="200" />`
    : "";

  return `
    <div class="sub-stage-section">
      <div class="sub-stage-header">
        <span class="sub-stage-label">Production Stage</span>
        <span class="sub-badge ${getSubBadgeClass(current)}">${current}</span>
      </div>
      <div class="sub-stage-track">${steps}</div>
      ${editMode && nextSub ? `
        <div class="sub-stage-advance">
          ${subNoteInput}
          ${advanceSubBtn}
        </div>` : ""}
    </div>`;
}

function advanceSubStage(orderId) {
  // Rapid-click protection
  if (advanceLock.has(`sub-${orderId}`)) return;
  advanceLock.add(`sub-${orderId}`);
  setTimeout(() => advanceLock.delete(`sub-${orderId}`), 600);

  const order = orders.find(o => o.id === orderId);
  if (!order || order.currentStage !== "In Production") return;

  const noteInput = document.getElementById(`sub-note-input-${orderId}`);
  const note = noteInput ? noteInput.value.trim() : "";

  const current = order.subStage || "Carpentry";
  const currentIndex = SUB_STAGES.indexOf(current);
  const nextSub = SUB_STAGES[currentIndex + 1];

  if (!nextSub) return;

  // Save note under sub-stage key
  if (note) {
    if (!order.subStageNotes) order.subStageNotes = {};
    order.subStageNotes[current] = note;
  }

  order.subStage = nextSub;
  saveToStorage();
  renderOrders();
}

/* ----------------------------------------------------------
   7. RENDER COMPLETED
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
    completed.forEach(order => container.appendChild(buildCompletedCard(order)));
  }
}

function buildCompletedCard(order) {
  const card = document.createElement("div");
  card.className = "completed-card";
  card.dataset.id = order.id;

  const skuSummary = order.skus.map(s => `${s.quantity} ${s.productType}`).join(", ");

  const noteRows = STAGES.map(stage => {
    const note = order.stageNotes[stage];
    if (!note) return "";
    return `
      <div class="completed-stage-note-row">
        <span class="completed-stage-note-label">${stage}:</span>
        <span>${escapeHTML(note)}</span>
      </div>`;
  }).join("");

  const subNoteRows = order.subStageNotes
    ? Object.entries(order.subStageNotes).map(([sub, note]) => note ? `
        <div class="completed-stage-note-row">
          <span class="completed-stage-note-label">&nbsp;&nbsp;${sub}:</span>
          <span>${escapeHTML(note)}</span>
        </div>` : "").join("")
    : "";

  card.innerHTML = `
    <div class="completed-card-header" onclick="toggleCompleted('${order.id}')">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0;">
        <span class="order-id">${escapeHTML(order.id)}</span>
        <span style="font-weight:600;word-break:break-word;">${escapeHTML(order.projectName)}</span>
        <span style="color:var(--text-secondary);font-size:0.82rem;">${escapeHTML(order.clientName)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
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
      ${noteRows || subNoteRows
        ? `<div class="completed-stage-notes">${noteRows}${subNoteRows}</div>`
        : ""}
    </div>`;

  return card;
}

function toggleCompleted(orderId) {
  document.getElementById(`completed-body-${orderId}`)?.classList.toggle("open");
  document.getElementById(`chevron-${orderId}`)?.classList.toggle("open");
}

/* ----------------------------------------------------------
   8. ADD ORDER FORM
   ---------------------------------------------------------- */

function addSkuRow() {
  const skuList = document.getElementById("sku-list");
  const index = skuList.children.length + 1;
  const productOptions = PRODUCT_TYPES.map(p =>
    `<option value="${p}">${p}</option>`).join("");

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
        <label>Qty <span class="required">*</span></label>
        <input type="number" class="sku-qty" min="1" max="9999" placeholder="e.g. 3" />
      </div>
      <div style="flex:1;">
        <label>Unit</label>
        <select class="sku-unit">
          <option value="Pieces">Pieces</option>
          <option value="Square Feet">Sq Ft</option>
        </select>
      </div>
    </div>
    <label>Size</label>
    <div class="sku-inline">
      <input type="text" class="sku-size" placeholder="e.g. 2100 x 900" style="flex:2;" maxlength="50" />
      <select class="sku-size-unit" style="flex:1;">
        <option value="mm">mm</option>
        <option value="M">M</option>
        <option value="ft">ft</option>
      </select>
    </div>
    <label>Thickness (mm)</label>
    <input type="number" class="sku-thickness" min="1" max="999" placeholder="e.g. 18" />
    <label>Material</label>
    <input type="text" class="sku-material" placeholder="e.g. Teak Veneer" maxlength="80" />
    <label>Additional Notes</label>
    <input type="text" class="sku-notes" placeholder="Optional" maxlength="120" />
  `;
  skuList.appendChild(row);
  renumberSkuRows();
}

function removeSkuRow(btn) {
  // Prevent removing the only row
  const skuList = document.getElementById("sku-list");
  if (skuList.children.length <= 1) {
    const err = document.getElementById("sku-error");
    err.textContent = "At least one item is required.";
    err.classList.remove("hidden");
    return;
  }
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

function validateField(el, condition) {
  el.classList.toggle("input-error", !condition);
  return condition;
}

document.getElementById("order-form").addEventListener("submit", function (e) {
  e.preventDefault();

  const clientEl  = document.getElementById("client-name");
  const projectEl = document.getElementById("project-name");
  const dueDateEl = document.getElementById("due-date");
  const formError = document.getElementById("form-error");
  const skuError  = document.getElementById("sku-error");

  const clientOk  = validateField(clientEl,  clientEl.value.trim() !== "");
  const projectOk = validateField(projectEl, projectEl.value.trim() !== "");
  const dateOk    = validateField(dueDateEl, dueDateEl.value !== "");

  formError.classList.toggle("hidden", clientOk && projectOk && dateOk);

  const skus = readSkusFromForm();
  let skusOk = skus.length > 0;

  skus.forEach((sku, i) => {
    const qtyEl = document.querySelectorAll(".sku-row")[i]?.querySelector(".sku-qty");
    const valid = sku.quantity >= 1;
    if (qtyEl) qtyEl.classList.toggle("input-error", !valid);
    if (!valid) skusOk = false;
  });

  if (!skusOk) {
    skuError.textContent = skus.length === 0
      ? "Add at least one item."
      : "Each item needs a quantity of at least 1.";
    skuError.classList.remove("hidden");
  } else {
    skuError.classList.add("hidden");
  }

  if (!clientOk || !projectOk || !dateOk || !skusOk) return;

  const newOrder = {
    id:           generateOrderId(),
    clientName:   clientEl.value.trim(),
    projectName:  projectEl.value.trim(),
    drawingRef:   document.getElementById("drawing-ref").value.trim(),
    dueDate:      dueDateEl.value,
    currentStage: "Order Received",
    subStage:     "Carpentry",     // default sub-stage ready for In Production
    subStageNotes:{},
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
  saveToStorage();
  resetForm();
  renderOrders();

  // Flash the new card and scroll to it
  requestAnimationFrame(() => {
    const newCard = document.querySelector(`.order-card[data-id="${newOrder.id}"]`);
    if (newCard) {
      newCard.classList.add("card-flash");
      newCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
      newCard.addEventListener("animationend", () => newCard.classList.remove("card-flash"), { once: true });
    }
  });
});

["client-name", "project-name", "due-date"].forEach(id => {
  document.getElementById(id)?.addEventListener("input", function () {
    this.classList.remove("input-error");
    document.getElementById("form-error")?.classList.add("hidden");
  });
});

function resetForm() {
  document.getElementById("order-form").reset();
  document.getElementById("sku-list").innerHTML = "";
  document.getElementById("form-error").classList.add("hidden");
  document.getElementById("sku-error").classList.add("hidden");
  addSkuRow();
}

/* ----------------------------------------------------------
   9. ADVANCE MAIN STAGE
   ---------------------------------------------------------- */

function advanceStage(orderId) {
  if (advanceLock.has(orderId)) return;
  advanceLock.add(orderId);
  setTimeout(() => advanceLock.delete(orderId), 600);

  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  // Block advance from In Production unless sub-stage is Finishing
  if (order.currentStage === "In Production" && order.subStage !== "Finishing") return;

  const noteInput = document.getElementById(`note-input-${orderId}`);
  const note = noteInput ? noteInput.value.trim() : "";
  if (note) order.stageNotes[order.currentStage] = note;

  const currentIndex = STAGES.indexOf(order.currentStage);
  if (currentIndex < STAGES.length - 1) {
    order.currentStage = STAGES[currentIndex + 1];
  }

  saveToStorage();
  renderOrders();
}

/* ----------------------------------------------------------
   10. FILTER
   ---------------------------------------------------------- */

document.getElementById("filter-stage").addEventListener("change", function () {
  currentFilter = this.value;
  renderOrders();
});

/* ----------------------------------------------------------
   11. RESET — inline confirm, no window.confirm
   ---------------------------------------------------------- */

function updateResetBtn() {
  const btn = document.getElementById("reset-btn");
  const completed = orders.filter(o => o.currentStage === "Dispatched");
  const show = editMode && completed.length > 0;
  btn.classList.toggle("hidden", !show);
  if (!show) cancelResetConfirm();
}

function cancelResetConfirm() {
  pendingResetConfirm = false;
  document.getElementById("reset-confirm-box")?.remove();
  const btn = document.getElementById("reset-btn");
  if (btn) btn.textContent = "Clear Completed";
}

document.getElementById("reset-btn").addEventListener("click", function () {
  if (pendingResetConfirm) {
    cancelResetConfirm();
    orders = orders.filter(o => o.currentStage !== "Dispatched");
    saveToStorage();
    renderOrders();
    return;
  }

  pendingResetConfirm = true;
  this.textContent = "Confirm Clear";

  const confirmBox = document.createElement("div");
  confirmBox.className = "inline-confirm";
  confirmBox.id = "reset-confirm-box";
  confirmBox.innerHTML = `
    <span>Removes all completed orders. Active orders stay.</span>
    <button class="btn btn-danger btn-sm"
      onclick="document.getElementById('reset-btn').click()">Yes, clear</button>
    <button class="btn btn-ghost btn-sm" onclick="cancelResetConfirm()">Cancel</button>
  `;

  document.querySelector(".board-controls-right")
    .insertAdjacentElement("afterend", confirmBox);
});

/* ----------------------------------------------------------
   12. EDIT MODE
   ---------------------------------------------------------- */

document.getElementById("edit-mode-btn").addEventListener("click", function () {
  editMode ? exitEditMode() : showPinOverlay();
});

function showPinOverlay() {
  document.getElementById("pin-overlay").classList.remove("hidden");
  document.getElementById("pin-input").value = "";
  document.getElementById("pin-error").classList.add("hidden");
  setTimeout(() => document.getElementById("pin-input").focus(), 50);
}

function enterEditMode() {
  editMode = true;
  document.getElementById("pin-overlay").classList.add("hidden");

  const btn = document.getElementById("edit-mode-btn");
  btn.textContent = "Exit Edit Mode";
  btn.classList.replace("btn-outline", "btn-primary");

  document.getElementById("edit-indicator").classList.remove("hidden");
  document.getElementById("order-form").classList.remove("hidden");
  document.getElementById("sidebar-locked-msg").classList.add("hidden");

  // Add a blank SKU row now that the form is visible
  if (document.getElementById("sku-list").children.length === 0) addSkuRow();

  renderOrders();
}

function exitEditMode() {
  editMode = false;
  cancelResetConfirm();

  const btn = document.getElementById("edit-mode-btn");
  btn.textContent = "Enter Edit Mode";
  btn.classList.replace("btn-primary", "btn-outline");

  document.getElementById("edit-indicator").classList.add("hidden");
  document.getElementById("order-form").classList.add("hidden");
  document.getElementById("sidebar-locked-msg").classList.remove("hidden");

  renderOrders();
}

document.getElementById("pin-submit").addEventListener("click", function () {
  if (document.getElementById("pin-input").value === PIN) {
    enterEditMode();
  } else {
    document.getElementById("pin-error").classList.remove("hidden");
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

document.getElementById("pin-overlay").addEventListener("click", function (e) {
  if (e.target === this) this.classList.add("hidden");
});

/* ----------------------------------------------------------
   13. SIDEBAR TOGGLE
   ---------------------------------------------------------- */

document.getElementById("sidebar-toggle").addEventListener("click", () => {
  document.getElementById("sidebar").classList.add("collapsed");
  document.getElementById("sidebar-open-btn").classList.remove("hidden");
});

document.getElementById("sidebar-open-btn").addEventListener("click", function () {
  this.classList.add("hidden");
  document.getElementById("sidebar").classList.remove("collapsed");
});

/* ----------------------------------------------------------
   14. SAMPLE DATA
   ---------------------------------------------------------- */

function loadSampleData() {
  const existingIds = new Set(orders.map(o => o.id));

  const samples = [
    {
      id: "SF-20JUN-001", clientName: "Mehra Enterprises",
      projectName: "Corporate Office — Gurgaon", drawingRef: "DWG-2026-012",
      dueDate: "2026-06-20", currentStage: "In Production",
      subStage: "Painting", subStageNotes: { "Carpentry": "Carcass completed" },
      dateAdded: "2026-06-15",
      skus: [
        { productType: "Doors", quantity: 12, unit: "Pieces", size: "2100 x 900", sizeUnit: "mm", thickness: "32", material: "Walnut Veneer", additionalNotes: "Flush finish" },
        { productType: "Wall Panels", quantity: 240, unit: "Square Feet", size: "2400 x 1200", sizeUnit: "mm", thickness: "18", material: "Oak Veneer", additionalNotes: "" }
      ],
      stageNotes: { "Order Received": "PO confirmed", "Material Sourced": "Veneer received", "In Production": "", "Quality Check": "", "Dispatched": "" }
    },
    {
      id: "SF-22JUN-002", clientName: "Sharma Family",
      projectName: "Ireo Ascott — Master Bedroom", drawingRef: "DWG-2026-019",
      dueDate: "2026-06-28", currentStage: "Material Sourced",
      subStage: "Carpentry", subStageNotes: {},
      dateAdded: "2026-06-22",
      skus: [
        { productType: "Wardrobe", quantity: 2, unit: "Pieces", size: "2400 x 600", sizeUnit: "mm", thickness: "18", material: "White Laminate", additionalNotes: "Soft close hinges" },
        { productType: "Kitchen Shutters", quantity: 18, unit: "Pieces", size: "600 x 450", sizeUnit: "mm", thickness: "12", material: "Acrylic Gloss", additionalNotes: "Handle-less profile" }
      ],
      stageNotes: { "Order Received": "Rush order — 28 Jun delivery", "Material Sourced": "Acrylic panels sourced", "In Production": "", "Quality Check": "", "Dispatched": "" }
    },
    {
      id: "SF-23JUN-003", clientName: "Kapoor & Associates",
      projectName: "DLF Cyber City — Boardroom", drawingRef: "DWG-2026-024",
      dueDate: "2026-07-15", currentStage: "Order Received",
      subStage: "Carpentry", subStageNotes: {},
      dateAdded: "2026-06-23",
      skus: [{ productType: "Wall Panels", quantity: 320, unit: "Square Feet", size: "2700 x 1200", sizeUnit: "mm", thickness: "18", material: "Veneer — Dark Wenge", additionalNotes: "" }],
      stageNotes: { "Order Received": "", "Material Sourced": "", "In Production": "", "Quality Check": "", "Dispatched": "" }
    },
    {
      id: "SF-24JUN-004", clientName: "Patel Residence",
      projectName: "Golf Links — Living Room", drawingRef: "DWG-2026-028",
      dueDate: "2026-07-15", currentStage: "Quality Check",
      subStage: "Finishing", subStageNotes: { "Carpentry": "Done", "Painting": "Done" },
      dateAdded: "2026-06-24",
      skus: [
        { productType: "Loose Furniture", quantity: 4, unit: "Pieces", size: "900 x 450", sizeUnit: "mm", thickness: "25", material: "Solid Teak", additionalNotes: "Oiled finish" },
        { productType: "Flooring", quantity: 180, unit: "Square Feet", size: "600 x 100", sizeUnit: "mm", thickness: "12", material: "Engineered Wood", additionalNotes: "Herringbone pattern" }
      ],
      stageNotes: { "Order Received": "Drawings signed off", "Material Sourced": "Teak from Kerala", "In Production": "Flooring done early", "Quality Check": "", "Dispatched": "" }
    },
    {
      id: "SF-18JUN-001", clientName: "Anand Constructions",
      projectName: "Sector 62 — Show Apartment", drawingRef: "DWG-2026-007",
      dueDate: "2026-06-20", currentStage: "Dispatched",
      subStage: "Finishing", subStageNotes: {},
      dateAdded: "2026-06-10",
      skus: [{ productType: "Kitchen Shutters", quantity: 24, unit: "Pieces", size: "600 x 500", sizeUnit: "mm", thickness: "12", material: "PU Gloss White", additionalNotes: "" }],
      stageNotes: { "Order Received": "Show apartment spec", "Material Sourced": "PU panels in stock", "In Production": "Completed in 6 days", "Quality Check": "All passed", "Dispatched": "Installed on site" }
    },
    {
      id: "SF-19JUN-002", clientName: "Verma Family",
      projectName: "Vasant Vihar — Study Room", drawingRef: "DWG-2026-009",
      dueDate: "2026-06-22", currentStage: "Dispatched",
      subStage: "Finishing", subStageNotes: {},
      dateAdded: "2026-06-12",
      skus: [
        { productType: "Wardrobe", quantity: 1, unit: "Pieces", size: "2100 x 600", sizeUnit: "mm", thickness: "18", material: "Linen Texture Laminate", additionalNotes: "Open shelf section" },
        { productType: "Loose Furniture", quantity: 1, unit: "Pieces", size: "1200 x 600", sizeUnit: "mm", thickness: "25", material: "Solid Sheesham", additionalNotes: "Cable management" }
      ],
      stageNotes: { "Order Received": "Drawings approved 12 Jun", "Material Sourced": "Sheesham local", "In Production": "On schedule", "Quality Check": "Touch-up done", "Dispatched": "Delivered 22 Jun" }
    }
  ];

  samples.forEach(s => { if (!existingIds.has(s.id)) { orders.push(s); orderCounter++; } });
  saveToStorage();
  renderOrders();
}

document.getElementById("load-sample-btn").addEventListener("click", loadSampleData);
document.getElementById("empty-load-sample").addEventListener("click", loadSampleData);
document.getElementById("add-sku-btn").addEventListener("click", addSkuRow);

/* ----------------------------------------------------------
   15. INIT
   ---------------------------------------------------------- */

function init() {
  loadFromStorage();
  document.getElementById("order-form").classList.add("hidden");
  document.getElementById("sidebar-locked-msg").classList.remove("hidden");
  renderOrders();
}

init();
