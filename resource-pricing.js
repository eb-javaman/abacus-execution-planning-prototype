/* ============================================================
   Resource Unit Price — Knowledge-synced catalog + selection drawer

   Post-import pricing workflow: Simulation provides execution information
   (tasks, equipment, hours); Abacus assigns Resource Unit Prices and
   calculates costs. Selecting a record populates Standard / Overtime /
   Weekend-Holiday prices, then Unit Rate and Amount are derived from
   Standard Price × Standard Hours (planning uses standard hours only).

   This drawer is search & select only — no create/edit/delete. Automatic
   best-match / recommendation logic is explicitly deferred (manual MVP).

   Depends on globals defined in index.html: state, $, fmt$, toast,
   enterEdit, render, scTaskTotal.
============================================================ */

/* Knowledge Database records — read-only in Execution Planning.
   Each record carries all three pricing definitions; the headline price is Standard. */
const RESOURCE_PRICES = [
  { id:'RP-001', category:'Machinery', name:'Backhoe 0.7m³',        std:27.75, ot:41.60,  we:55.50,  specs:'0.7 m³',    cat:'機械' },
  { id:'RP-002', category:'Machinery', name:'Backhoe 1.0m³',        std:37.25, ot:55.90,  we:74.50,  specs:'1.0 m³',    cat:'機械' },
  { id:'RP-003', category:'Machinery', name:'Bulldozer D61PX',      std:39.62, ot:59.40,  we:79.25,  specs:'20.4 t',    cat:'機械' },
  { id:'RP-004', category:'Machinery', name:'Bulldozer D37PX',      std:20.61, ot:30.90,  we:41.20,  specs:'9.6 t',     cat:'機械' },
  { id:'RP-005', category:'Machinery', name:'Vibratory Roller 10t', std:31.62, ot:47.40,  we:63.25,  specs:'10 t',      cat:'機械' },
  { id:'RP-006', category:'Machinery', name:'Vibratory Roller 4t',  std:18.04, ot:27.10,  we:36.10,  specs:'4 t',       cat:'機械' },
  { id:'RP-007', category:'Machinery', name:'Dump Truck 10t',       std:57.98, ot:86.95,  we:115.95, specs:'10 t',      cat:'機械' },
  { id:'RP-008', category:'Labor',     name:'Operator (Skilled)',   std:32.21, ot:48.30,  we:64.40,  specs:'—',         cat:'労働力' },
  { id:'RP-009', category:'Labor',     name:'General Labor',        std:17.50, ot:26.25,  we:35.00,  specs:'—',         cat:'労働力' },
];

const _rpState = { rowId: null, taskIdx: null };

function rpActiveTask() {
  const row = state.rows.find(r => r.id === _rpState.rowId);
  if (!row || !row.sc) return null;
  return row.sc.tasks[_rpState.taskIdx] || null;
}

/* Renders the Resource Unit Price cell in the Simulation-generated Tasks table.
   Same selection pattern as the parent Unit Rate cell: value + knowledge button. */
function resourcePriceCell(rowId, taskIdx, task) {
  const label = task.resource
    ? `<div class="rp-cell-name">${task.resource.name}</div>
       <div class="rp-cell-sub">${task.resource.category} · ${fmt$(task.resource.std)}/h</div>`
    : '<span class="locked-value">--</span>';
  return `<div class="rate-cell">
    <span class="rate-value">${label}</span>
    <button class="knowledge-btn" ${state.acquired ? 'disabled' : ''}
      onclick="event.stopPropagation(); if(!this.disabled) openResourcePriceDrawer('${rowId}', ${taskIdx})"
      title="${state.acquired ? 'Planning is locked' : 'Select Resource Unit Price from Knowledge'}">
      <svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-160q-132 0-226-37.5T160-290v-380q0-52 94-90t226-38q132 0 226 38t94 90v100q-19-3-37-7t-43-7v-12.5q0-30.43-58.5-55.46Q583-677 480-677t-161.5 25.04Q260-626.93 260-596.5q0 31.5 58.5 56.5T480-515h25q-3 6-3.5 12.5T501-490h-21q-86 0-159-17.5T200-561v97q0 31.5 58.5 56.5T480-382q-2 12-2 24.5t1 24.5h1q-86 0-159-17.5T200-405v95q0 30.43 58.5 55.46Q317-229.5 480-229.5q22 0 41.5-2.5T560-237q9 19 18.5 35t21.5 31q-30 5-58 8t-62 3Zm230 0v-119H591l149-141 150 141H770v119h-60Z"/></svg>
    </button>
  </div>`;
}

function openResourcePriceDrawer(rowId, taskIdx) {
  if (state.acquired) { toast('Planning is locked', 'error'); return; }
  _rpState.rowId = rowId;
  _rpState.taskIdx = Number(taskIdx);
  $('rp_search_input').value = '';
  renderResourcePriceList();
  $('resPriceDrawer').classList.add('show');
  $('resPriceDrawerScrim').classList.add('show');
}

function closeResourcePriceDrawer() {
  _rpState.rowId = null;
  _rpState.taskIdx = null;
  $('resPriceDrawer').classList.remove('show');
  $('resPriceDrawerScrim').classList.remove('show');
}

/* Records matching the task's equipment — matched on the equipment's leading token
   (e.g. "Vibratory Roller 10t" → all "Vibratory …" records). */
function rpMatchesFor(eqName) {
  const token = (eqName || '').toLowerCase().split(' ')[0];
  if (!token) return [];
  return RESOURCE_PRICES.filter(p => p.name.toLowerCase().includes(token));
}

function renderResourcePriceList() {
  const task = rpActiveTask();
  if (!task) return;

  const q = ($('rp_search_input').value || '').trim().toLowerCase();
  let records, showingLabel, warnText = '';

  if (q) {
    records = RESOURCE_PRICES.filter(p =>
      (p.name + ' ' + p.category).toLowerCase().includes(q));
    showingLabel = `"${$('rp_search_input').value.trim()}"`;
  } else {
    records = rpMatchesFor(task.eqName);
    if (records.length) {
      showingLabel = task.eqName;
    } else {
      // No match for the Simulation equipment → fall back to the full list
      records = RESOURCE_PRICES;
      showingLabel = 'All resources';
      warnText = `No matches for "${task.eqName}". Showing all ${RESOURCE_PRICES.length} resources — search or pick from the list to select manually.`;
    }
  }

  const warn = $('rp_warn');
  warn.style.display = warnText ? 'block' : 'none';
  warn.textContent = warnText;
  $('rp_showing_label').textContent = showingLabel;

  const list = $('rp_list');
  if (records.length === 0) {
    list.innerHTML = '<div class="rp-empty">No matching resources. Adjust the search term.</div>';
    return;
  }

  list.innerHTML = records.map(p => {
    const applied = task.resource && task.resource.id === p.id;
    return `<div class="rp-card">
      <div class="rp-row">
        <span class="rp-chip">${p.category}</span>
        <span class="rp-name">${p.name}</span>
        <span class="rp-price">${fmt$(p.std)}/h</span>
        ${applied
          ? '<span class="rp-applied">applied</span>'
          : `<button class="btn btn-sm primary" onclick="applyResourcePrice('${p.id}')">apply</button>`}
      </div>
      <div class="rp-meta">Specs: ${p.specs} &nbsp;|&nbsp; Category: ${p.cat}</div>
      ${applied ? '' : `<label class="rp-apply-all">
        <input type="checkbox" checked data-rp-all="${p.id}" />
        Apply to all rows using this resource
      </label>`}
    </div>`;
  }).join('');
}

/* Apply a Resource Unit Price record to the active task (optionally to every task
   using the same equipment). Populates Std / OT / WE prices, then recalculates the
   parent Unit Rate and Amount from standard pricing. */
function applyResourcePrice(recId) {
  const rec = RESOURCE_PRICES.find(p => p.id === recId);
  const row = state.rows.find(r => r.id === _rpState.rowId);
  const task = rpActiveTask();
  if (!rec || !row || !task) { closeResourcePriceDrawer(); return; }
  if (state.acquired) { closeResourcePriceDrawer(); toast('Planning is locked', 'error'); return; }
  if (!state.editMode) enterEdit();

  const checkbox = document.querySelector(`#resPriceDrawer input[data-rp-all="${recId}"]`);
  const applyAll = !!(checkbox && checkbox.checked);

  const targets = [];
  if (applyAll) {
    state.rows.forEach(r => (r.sc ? r.sc.tasks : []).forEach(t => {
      if (t.eqName === task.eqName) targets.push([r, t]);
    }));
  } else {
    targets.push([row, task]);
  }

  targets.forEach(([, t]) => {
    t.resource = { id: rec.id, name: rec.name, category: rec.category, std: rec.std };
    t.std = rec.std;
    t.ot = rec.ot;
    t.we = rec.we;
  });

  new Set(targets.map(([r]) => r)).forEach(recomputeRowCost);

  state.dirty = true;
  state.dirtyCost = true; // pricing is the Abacus cost layer — never re-triggers Simulation
  closeResourcePriceDrawer();
  render();
  toast(`Applied "${rec.name}"${applyAll && targets.length > 1 ? ` to ${targets.length} tasks` : ''}`, 'success');
}

/* Amount = Σ (Standard Price × Standard Hours) over priced tasks;
   Unit Rate = Amount / Quantity. Unpriced tasks are excluded until assigned. */
function recomputeRowCost(r) {
  if (!r.sc) return;
  const priced = r.sc.tasks.filter(t => t.std != null && t.std !== '');
  if (priced.length === 0) { r.rate = ''; r.amount = ''; return; }
  const total = priced.reduce((sum, t) => sum + scTaskTotal(t), 0);
  r.amount = +total.toFixed(2);
  r.rate = (r.qty && Number(r.qty) > 0) ? +(total / Number(r.qty)).toFixed(4) : '';
}
