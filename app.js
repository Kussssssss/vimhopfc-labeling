const LABELS = ["SUP", "REFUTE", "NEI"];
const LABEL_NAMES = {
  SUP: "SUP",
  REFUTE: "REFUTE",
  NEI: "NEI",
};
const PALETTE = [
  "53, 168, 82",    // Green
  "217, 53, 53",    // Red
  "63, 122, 216",   // Blue
  "230, 115, 0",    // Orange
  "128, 0, 128",    // Purple
  "0, 150, 136",    // Teal
  "233, 30, 99",    // Pink
  "121, 85, 72",    // Brown
  "0, 188, 212",    // Cyan
  "139, 195, 74",   // Light Green
];
window.hoveredEvidenceId = null;
window.hoveredClaimId = null;
function getSpanBackground(evidences, hasEntity) {
  if (hasEntity) {
    return `var(--entity)`;
  }
  
  let layers = [];
  if (window.hoveredEvidenceId) {
    const hoveredEv = evidences.find(e => e.id === window.hoveredEvidenceId);
    if (hoveredEv) {
      layers.push(`linear-gradient(rgba(${hoveredEv.colorRgb}, 0.5), rgba(${hoveredEv.colorRgb}, 0.5))`);
    } else {
      evidences.forEach(e => layers.push(`linear-gradient(rgba(${e.colorRgb}, 0.08), rgba(${e.colorRgb}, 0.08))`));
    }
  } else if (window.hoveredClaimId) {
    const hoveredClaimEvs = evidences.filter(e => e.claimId === window.hoveredClaimId);
    if (hoveredClaimEvs.length > 0) {
      hoveredClaimEvs.forEach(e => layers.push(`linear-gradient(rgba(${e.colorRgb}, 0.5), rgba(${e.colorRgb}, 0.5))`));
    } else {
      evidences.forEach(e => layers.push(`linear-gradient(rgba(${e.colorRgb}, 0.08), rgba(${e.colorRgb}, 0.08))`));
    }
  } else {
    evidences.forEach(e => layers.push(`linear-gradient(rgba(${e.colorRgb}, 0.3), rgba(${e.colorRgb}, 0.3))`));
  }
  
  return layers.length ? layers.join(", ") : "";
}
function updateEvidenceHighlights() {
  document.querySelectorAll('.evidence-hit, .entity-hit').forEach(span => {
    const hasEntity = span.dataset.hasEntity === "true";
    const evs = JSON.parse(span.dataset.evidences || "[]");
    span.style.background = getSpanBackground(evs, hasEntity);
  });

  document.querySelectorAll('.evidence-tag').forEach(tag => {
    const evId = tag.dataset.evId;
    const claimId = tag.dataset.claimId;
    if (window.hoveredEvidenceId) {
      tag.style.opacity = evId === window.hoveredEvidenceId ? "1" : "0.15";
    } else if (window.hoveredClaimId) {
      tag.style.opacity = claimId === window.hoveredClaimId ? "1" : "0.15";
    } else {
      tag.style.opacity = "1";
    }
  });
}
const state = {
  allRows: [],
  rows: [],
  currentIndex: 0,
  annotations: {},
  selectedRange: null,
  sourceName: "data.sample.csv",
};
const els = {
  sampleMeta: document.getElementById("sampleMeta"),
  csvInput: document.getElementById("csvInput"),
  exportJsonBtn: document.getElementById("exportJsonBtn"),
  exportCsvBtn: document.getElementById("exportCsvBtn"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  sampleIndex: document.getElementById("sampleIndex"),
  sampleCount: document.getElementById("sampleCount"),
  statusFilter: document.getElementById("statusFilter"),
  searchInput: document.getElementById("searchInput"),
  bridgeEntity: document.getElementById("bridgeEntity"),
  bridgeType: document.getElementById("bridgeType"),
  subjectEntity: document.getElementById("subjectEntity"),
  subjectType: document.getElementById("subjectType"),
  contextA: document.getElementById("contextA"),
  contextAStats: document.getElementById("contextAStats"),
  contextB: document.getElementById("contextB"),
  contextBStats: document.getElementById("contextBStats"),
  claimsList: document.getElementById("claimsList"),
  claimTemplate: document.getElementById("claimTemplate"),
  rowStatusSelect: document.getElementById("rowStatusSelect"),
  showStatsBtn: document.getElementById("showStatsBtn"),
  statsModal: document.getElementById("statsModal"),
  closeStatsBtn: document.getElementById("closeStatsBtn"),
  statsPercent: document.getElementById("statsPercent"),
  statsProgressBar: document.getElementById("statsProgressBar"),
  statsProgressText: document.getElementById("statsProgressText"),
  statTodoCount: document.getElementById("statTodoCount"),
  statDoneCount: document.getElementById("statDoneCount"),
  statSkipCount: document.getElementById("statSkipCount"),
  statEditCount: document.getElementById("statEditCount"),
  chartContainer: document.getElementById("chartContainer"),
  evidenceModal: document.getElementById("evidenceModal"),
  closeEvidenceBtn: document.getElementById("closeEvidenceBtn"),
  evidenceModalTitle: document.getElementById("evidenceModalTitle"),
  evidenceModalContent: document.getElementById("evidenceModalContent"),
};
function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function storageKey() {
  return `mh-labeler:${state.sourceName}`;
}
function saveAnnotations() {
  localStorage.setItem(storageKey(), JSON.stringify(state.annotations));
}
function loadAnnotations() {
  try {
    state.annotations = JSON.parse(localStorage.getItem(storageKey()) || "{}");
  } catch {
    state.annotations = {};
  }
}
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(field);
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += ch;
  }
  row.push(field);
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  const headers = rows.shift() || [];
  return rows.map((cells, index) => {
    const item = { __rowNumber: index + 2 };
    headers.forEach((header, columnIndex) => {
      item[header] = cells[columnIndex] || "";
    });
    return normalizeRow(item);
  });
}
function safeJson(text) {
  if (!text || !text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
function cleanMarkedText(text) {
  return String(text || "").replace(/\[\[(.*?)\]\]/g, "$1");
}
function extractMarkedRanges(text) {
  const ranges = [];
  const source = String(text || "");
  let clean = "";
  let cursor = 0;
  const regex = /\[\[(.*?)\]\]/g;
  let match;
  while ((match = regex.exec(source))) {
    clean += source.slice(cursor, match.index);
    const start = clean.length;
    clean += match[1];
    ranges.push({
      start,
      end: clean.length,
      type: "marked",
      text: match[1],
    });
    cursor = match.index + match[0].length;
  }
  clean += source.slice(cursor);
  return { clean, ranges };
}
function normalizeForFind(text) {
  return String(text || "").toLocaleLowerCase("vi-VN");
}
function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function addEntityRanges(text, entityTexts, existingRanges) {
  const ranges = [...existingRanges];
  const haystack = normalizeForFind(text);
  const seen = new Set(ranges.map((range) => `${range.start}:${range.end}`));
  entityTexts
    .filter(Boolean)
    .map((entity) => cleanMarkedText(entity).trim())
    .filter((entity, index, arr) => entity && arr.indexOf(entity) === index)
    .forEach((entity) => {
      const needle = normalizeForFind(entity);
      let index = 0;
      while ((index = haystack.indexOf(needle, index)) !== -1) {
        const key = `${index}:${index + needle.length}`;
        if (!seen.has(key)) {
          ranges.push({
            start: index,
            end: index + needle.length,
            type: "entity",
            text: text.slice(index, index + needle.length),
          });
          seen.add(key);
        }
        index += Math.max(needle.length, 1);
      }
    });
  return ranges.filter((range) => range.end > range.start);
}
function normalizeRow(row) {
  const sub = safeJson(row.sub_question_result);
  const hop = safeJson(row.multi_hop_result);
  const contentA = row.bridge_content || sub?.analysis?.document_a_segments || "";
  const contentB = row.subject_content || sub?.analysis?.document_b_segments || row.segment_text || "";
  const markedA = extractMarkedRanges(contentA);
  const markedB = extractMarkedRanges(contentB);
  const contextA = markedA.clean || "";
  const contextB = markedB.clean || "";
  const entityTexts = [
    row.bridge_entity,
    row.subject_entity,
    sub?.sub_questions?.answer_a,
    sub?.sub_questions?.answer_b,
    hop.answer,
  ];
  return {
    ...row,
    key: [
      row.bridge_id,
      row.subject_id,
      row.bridge_entity,
      row.subject_entity,
      row.__rowNumber,
    ].join("|"),
    sub,
    hop,
    contextA,
    contextB,
    entityRanges: {
      A: addEntityRanges(contextA, entityTexts, markedA.ranges),
      B: addEntityRanges(contextB, entityTexts, markedB.ranges),
    },
  };
}
function currentRow() {
  return state.rows[state.currentIndex] || null;
}
function calculateStats() {
  let total = state.allRows.length;
  let todo = 0;
  let done = 0;
  let skip = 0;
  let edit = 0;

  let claimsCount = {
    SUP: 0,
    REFUTE: 0,
    NEI: 0
  };

  state.allRows.forEach(row => {
    const ann = state.annotations[row.key];
    const status = ann?.status || (ann?.claims && ann.claims.length > 0 ? "DONE" : "TODO");
    if (status === "DONE") done++;
    else if (status === "SKIP") skip++;
    else if (status === "EDIT") edit++;
    else todo++;

    if (ann && ann.claims) {
      ann.claims.forEach(claim => {
        const label = String(claim.label || "").toUpperCase();
        if (claimsCount[label] !== undefined) {
          claimsCount[label]++;
        }
      });
    }
  });

  return { total, todo, done, skip, edit, claimsCount };
}
function showStatsModal() {
  const stats = calculateStats();
  const percent = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
  
  if (els.statsPercent) els.statsPercent.textContent = `${percent}%`;
  if (els.statsProgressBar) els.statsProgressBar.style.width = `${percent}%`;
  if (els.statsProgressText) els.statsProgressText.textContent = `${stats.done} / ${stats.total} bài`;
  
  if (els.statTodoCount) els.statTodoCount.textContent = stats.todo;
  if (els.statDoneCount) els.statDoneCount.textContent = stats.done;
  if (els.statSkipCount) els.statSkipCount.textContent = stats.skip;
  if (els.statEditCount) els.statEditCount.textContent = stats.edit;

  if (els.chartContainer) {
    els.chartContainer.innerHTML = "";
    const totalClaims = stats.claimsCount.SUP + stats.claimsCount.REFUTE + stats.claimsCount.NEI;

    const labelDefs = [
      { name: "SUP", count: stats.claimsCount.SUP, color: "var(--sup-border)", fillClass: "sup-fill" },
      { name: "REFUTE", count: stats.claimsCount.REFUTE, color: "var(--refute-border)", fillClass: "refute-fill" },
      { name: "NEI", count: stats.claimsCount.NEI, color: "var(--nei-border)", fillClass: "nei-fill" }
    ];

    labelDefs.forEach(lbl => {
      const percentage = totalClaims > 0 ? Math.round((lbl.count / totalClaims) * 100) : 0;
      
      const chartItem = document.createElement("div");
      chartItem.className = "chart-item";
      
      chartItem.innerHTML = `
        <div class="chart-item-label">
          <span class="label-name" style="color: ${lbl.color}; font-weight: 700;">${lbl.name}</span>
          <span class="label-stats" style="font-weight: 500; font-size: 13px;">${lbl.count} câu (${percentage}%)</span>
        </div>
        <div class="chart-bar-bg">
          <div class="chart-bar-fill ${lbl.fillClass}" style="width: ${percentage}%;"></div>
        </div>
      `;
      els.chartContainer.appendChild(chartItem);
    });
  }

  if (els.statsModal) els.statsModal.style.display = "flex";
}
function hideStatsModal() {
  if (els.statsModal) els.statsModal.style.display = "none";
}
function currentAnnotation() {
  const row = currentRow();
  if (!row) return { claims: [], status: "TODO" };
  if (!state.annotations[row.key]) {
    state.annotations[row.key] = { claims: [], status: "TODO" };
  } else if (!state.annotations[row.key].status) {
    state.annotations[row.key].status = state.annotations[row.key].claims.length > 0 ? "DONE" : "TODO";
  }
  return state.annotations[row.key];
}
function wordCount(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}
function claimOrdinal(claim, claims = currentAnnotation().claims, label = claim.label) {
  return claims.filter((item) => item.label === label).findIndex((item) => item.id === claim.id) + 1;
}
function evidenceOrdinal(claim, evidenceId) {
  return claim.evidences.findIndex((item) => item.id === evidenceId) + 1;
}
function evidenceTag(claim, evidence) {
  const claims = currentAnnotation().claims;
  const base = claimOrdinal(claim, claims, claim.label) || claims.indexOf(claim) + 1;
  const ordinal = evidenceOrdinal(claim, evidence.id);
  const suffix = ordinal > 1 ? `.${ordinal}` : "";
  return `Evidence ${evidence.label} ${base}${suffix}`;
}
function evidenceRangesFor(contextId) {
  const annotation = currentAnnotation();
  const evidenceRanges = [];
  annotation.claims.forEach((claim) => {
    const colorRgb = PALETTE[(claim.colorIndex || 0) % PALETTE.length];
    claim.evidences.forEach((ev) => {
      if (ev.contextId === contextId) {
        evidenceRanges.push({
          start: ev.start,
          end: ev.end,
          label: ev.label,
          id: ev.id,
          claimId: claim.id,
          tag: evidenceTag(claim, ev),
          colorRgb: colorRgb,
        });
      }
    });
  });
  return evidenceRanges;
}
function rangesOverlap(a, b) {
  return a.start < b.end && b.start < a.end;
}
function renderContext(contextId) {
  const row = currentRow();
  const target = contextId === "A" ? els.contextA : els.contextB;
  const text = contextId === "A" ? row?.contextA || "" : row?.contextB || "";
  const entityRanges = row?.entityRanges?.[contextId] || [];
  const evidenceRanges = evidenceRangesFor(contextId);
  const boundaries = new Set([0, text.length]);
  [...entityRanges, ...evidenceRanges].forEach((range) => {
    boundaries.add(Math.max(0, Math.min(text.length, range.start)));
    boundaries.add(Math.max(0, Math.min(text.length, range.end)));
  });
  const points = [...boundaries].sort((a, b) => a - b);
  target.textContent = "";
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    if (end <= start) continue;
    const segment = text.slice(start, end);
    const activeEntities = entityRanges.filter((range) => rangesOverlap(range, { start, end }));
    const activeEvidence = evidenceRanges.filter((range) => rangesOverlap(range, { start, end }));
    if (!activeEntities.length && !activeEvidence.length) {
      target.append(document.createTextNode(segment));
      continue;
    }
    const span = document.createElement("span");
    span.textContent = segment;
    
    span.dataset.hasEntity = activeEntities.length > 0 ? "true" : "false";
    if (activeEvidence.length) {
      span.classList.add("evidence-hit");
      span.dataset.evidences = JSON.stringify(activeEvidence.map(e => ({
        id: e.id, 
        claimId: e.claimId, 
        label: e.label, 
        colorRgb: e.colorRgb
      })));
    }
    if (activeEntities.length) {
      span.classList.add("entity-hit");
    }
    span.style.background = getSpanBackground(activeEvidence, activeEntities.length > 0);
    target.append(span);

    if (activeEvidence.length) {
      const ending = activeEvidence.filter((range) => range.end === end);
      if (ending.length) {
        ending.forEach((range) => {
          const wrapper = document.createElement("span");
          wrapper.className = "evidence-tag-wrapper evidence-hit";
          wrapper.dataset.hasEntity = "false";
          wrapper.dataset.evidences = JSON.stringify([{
            id: range.id, claimId: range.claimId, label: range.label, colorRgb: range.colorRgb
          }]);
          wrapper.style.background = getSpanBackground(JSON.parse(wrapper.dataset.evidences), false);
          
          const tagNode = document.createElement("span");
          tagNode.className = "evidence-tag";
          tagNode.textContent = range.tag;
          tagNode.dataset.evId = range.id;
          tagNode.dataset.claimId = range.claimId;
          tagNode.style.borderColor = `rgb(${range.colorRgb})`;
          
          wrapper.appendChild(tagNode);
          target.append(wrapper);
        });
      }
    }
  }
}
function renderClaims() {
  const annotation = currentAnnotation();
  els.claimsList.textContent = "";
  if (!annotation.claims.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Chưa có claim";
    els.claimsList.append(empty);
    return;
  }
  annotation.claims.forEach((claim, index) => {
    if (typeof claim.colorIndex !== 'number') {
      claim.colorIndex = index;
    }
    const colorRgb = PALETTE[claim.colorIndex % PALETTE.length];
    const fragment = els.claimTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".claim-card");
    const title = fragment.querySelector(".claim-title");
    const label = fragment.querySelector(".claim-label");
    const text = fragment.querySelector(".claim-text");
    const deleteBtn = fragment.querySelector(".delete-claim");
    const evidenceBox = fragment.querySelector(".claim-evidence");
    const addEvBtn = fragment.querySelector(".add-evidence-to-claim");
    const lockBtn = fragment.querySelector(".lock-claim-btn");
    const editBtn = fragment.querySelector(".edit-claim-btn");

    const isLocked = !!claim.locked;
    text.disabled = isLocked;
    label.disabled = isLocked;
    deleteBtn.disabled = isLocked;
    
    if (isLocked) {
      addEvBtn.style.display = "none";
      if (lockBtn) lockBtn.style.display = "none";
      if (editBtn) editBtn.style.display = "flex";
      card.classList.add("locked");
    } else {
      addEvBtn.style.display = "inline-flex";
      if (lockBtn) lockBtn.style.display = "inline-flex";
      if (editBtn) editBtn.style.display = "none";
      card.classList.remove("locked");
    }

    if (lockBtn) {
      lockBtn.addEventListener("click", () => {
        claim.locked = true;
        saveAnnotations();
        renderAll();
      });
    }

    if (editBtn) {
      editBtn.addEventListener("click", () => {
        claim.locked = false;
        saveAnnotations();
        renderAll();
      });
    }

    card.addEventListener('mouseenter', () => {
      window.hoveredClaimId = claim.id;
      updateEvidenceHighlights();
    });
    card.addEventListener('mouseleave', () => {
      window.hoveredClaimId = null;
      updateEvidenceHighlights();
    });
    addEvBtn.addEventListener("click", () => {
      const selectionRange = state.selectedRange;
      if (!selectionRange) return;
      claim.evidences.push({
        id: uid("ev"),
        label: claim.label,
        contextId: selectionRange.contextId,
        start: selectionRange.start,
        end: selectionRange.end,
        text: selectionRange.text,
        createdAt: new Date().toISOString(),
      });
      saveAnnotations();
      window.getSelection()?.removeAllRanges();
      updateSelection(null);
      renderAll();
    });
    card.dataset.label = claim.label;
    card.style.borderLeftColor = `rgb(${colorRgb})`;
    title.textContent = `Câu ${claim.label} ${claimOrdinal(claim)}`;
    label.value = claim.label;
    text.value = claim.text || "";
    label.addEventListener("change", () => {
      claim.label = label.value;
      claim.evidences.forEach((evidence) => {
        evidence.label = label.value;
      });
      saveAnnotations();
      renderAll();
    });
    text.addEventListener("input", () => {
      claim.text = text.value;
      saveAnnotations();
    });
    deleteBtn.addEventListener("click", () => {
      annotation.claims = annotation.claims.filter((item) => item.id !== claim.id);
      saveAnnotations();
      renderAll();
    });
    if (!claim.evidences.length) {
      const empty = document.createElement("div");
      empty.className = "empty-evidence";
      empty.textContent = "Chưa có evidence";
      evidenceBox.append(empty);
    } else {
      const evA = claim.evidences.filter(e => e.contextId === "A");
      const evB = claim.evidences.filter(e => e.contextId === "B");
      const renderGroup = (evList, title) => {
        if (!evList.length) return;
        const group = document.createElement("div");
        group.className = "evidence-group";
        const groupTitle = document.createElement("div");
        groupTitle.className = "evidence-group-title";
        groupTitle.textContent = title;
        const groupChips = document.createElement("div");
        groupChips.className = "evidence-group-chips";
        
        evList.forEach((evidence) => {
          const chip = document.createElement("div");
          chip.className = "evidence-chip";
          chip.style.borderColor = `rgb(${colorRgb})`;
          chip.style.backgroundColor = `rgba(${colorRgb}, 0.08)`;
          chip.style.color = `rgb(${colorRgb})`;
          chip.dataset.label = evidence.label;
          chip.addEventListener('mouseenter', () => {
            window.hoveredEvidenceId = evidence.id;
            updateEvidenceHighlights();
          });
          chip.addEventListener('mouseleave', () => {
            window.hoveredEvidenceId = null;
            updateEvidenceHighlights();
          });
          
          chip.addEventListener('click', (e) => {
            if (e.target.classList.contains("remove-evidence")) return;
            
            els.evidenceModalTitle.textContent = `Chi tiết Evidence - Câu ${claim.label} ${claimOrdinal(claim)}`;
            els.evidenceModalContent.innerHTML = "";
            
            claim.evidences.forEach((ev) => {
              const item = document.createElement("div");
              item.className = "evidence-modal-item";
              item.style.borderLeft = `4px solid rgb(${colorRgb})`;
              
              const tag = document.createElement("div");
              tag.className = "evidence-modal-item-tag";
              tag.style.color = `rgb(${colorRgb})`;
              tag.textContent = evidenceTag(claim, ev) + ` (Context ${ev.contextId})`;
              
              const text = document.createElement("div");
              text.className = "evidence-modal-item-text";
              text.textContent = ev.text;
              
              item.append(tag, text);
              
              if (ev.id === evidence.id) {
                 item.style.backgroundColor = `rgba(${colorRgb}, 0.1)`;
              }
              
              els.evidenceModalContent.append(item);
            });
            
            els.evidenceModal.style.display = "flex";
            
            setTimeout(() => {
              const activeIndex = claim.evidences.findIndex(e => e.id === evidence.id);
              const activeItem = els.evidenceModalContent.children[activeIndex];
              if (activeItem) {
                 activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, 50);
          });
          
          const tag = document.createElement("strong");
          tag.textContent = evidenceTag(claim, evidence);
          const remove = document.createElement("button");
          remove.className = "remove-evidence";
          remove.type = "button";
          remove.textContent = "×";
          remove.setAttribute("aria-label", "Xoa evidence");
          if (isLocked) {
            remove.style.display = "none";
          }
          remove.addEventListener("click", () => {
            claim.evidences = claim.evidences.filter((item) => item.id !== evidence.id);
            window.hoveredEvidenceId = null;
            saveAnnotations();
            renderAll();
          });
          chip.append(tag, remove);
          groupChips.append(chip);
        });
        group.append(groupTitle, groupChips);
        evidenceBox.append(group);
      };
      renderGroup(evA, "Context A");
      renderGroup(evB, "Context B");
    }
    els.claimsList.append(fragment);
  });
}
function renderSample() {
  const row = currentRow();
  if (!row) {
    els.sampleMeta.textContent = "Không có dữ liệu phù hợp";
    els.sampleIndex.value = "0";
    els.sampleCount.textContent = "/ 0";
    els.prevBtn.disabled = true;
    els.nextBtn.disabled = true;
    els.bridgeEntity.textContent = "-";
    els.bridgeType.textContent = "";
    els.subjectEntity.textContent = "-";
    els.subjectType.textContent = "";
    if (els.rowStatusSelect) els.rowStatusSelect.value = "TODO";
    els.contextAStats.textContent = "";
    els.contextBStats.textContent = "";
    els.contextA.textContent = "Trống";
    els.contextB.textContent = "Trống";
    els.claimsList.textContent = "";
    updateSelection(null);
    document.title = `MH Labeler · Trống`;
    return;
  }
  const annotation = currentAnnotation();
  const evidenceCount = annotation.claims.reduce((sum, claim) => sum + claim.evidences.length, 0);
  els.sampleMeta.textContent = `Sample ${state.currentIndex + 1}/${state.rows.length} · row ${row.__rowNumber} · ${row.status || "-"}`;
  els.sampleIndex.value = String(state.currentIndex + 1);
  els.sampleIndex.max = String(state.rows.length || 1);
  els.sampleCount.textContent = `/ ${state.rows.length}`;
  els.prevBtn.disabled = state.currentIndex <= 0;
  els.nextBtn.disabled = state.currentIndex >= state.rows.length - 1;
  els.bridgeEntity.textContent = row.bridge_entity || "-";
  els.bridgeType.textContent = row.bridge_type ? `(${row.bridge_type})` : "";
  els.subjectEntity.textContent = row.subject_entity || "-";
  els.subjectType.textContent = row.subject_type ? `(${row.subject_type})` : "";
  if (els.rowStatusSelect) {
    els.rowStatusSelect.value = annotation.status || "TODO";
  }
  els.contextAStats.textContent = `${wordCount(row.contextA)} từ`;
  els.contextBStats.textContent = `${wordCount(row.contextB)} từ · rank ${row.rank || "-"}`;
  renderContext("A");
  renderContext("B");
  renderClaims();
  updateSelection(null);
  els.exportJsonBtn.disabled = !Object.keys(state.annotations).length;
  els.exportCsvBtn.disabled = !Object.keys(state.annotations).length;
  document.title = `MH Labeler · ${annotation.claims.length} claims · ${evidenceCount} evidence`;
}
function renderAll() {
  renderSample();
}
function applyFilters() {
  const status = els.statusFilter.value;
  const query = normalizeForFind(els.searchInput.value.trim());
  const previousKey = currentRow()?.key;
  state.rows = state.allRows.filter((row) => {
    let statusMatch = true;
    if (status !== "ALL") {
      const ann = state.annotations[row.key];
      const annStatus = ann?.status || (ann?.claims && ann.claims.length > 0 ? "DONE" : "TODO");
      statusMatch = annStatus === status;
    }
    if (!statusMatch) return false;
    if (!query) return true;
    const haystack = normalizeForFind(
      [
        row.bridge_entity,
        row.subject_entity,
        row.contextA,
        row.contextB,
        row.hop?.multi_hop_question,
        row.hop?.answer,
      ].join(" "),
    );
    return haystack.includes(query);
  });
  const nextIndex = state.rows.findIndex((row) => row.key === previousKey);
  state.currentIndex = nextIndex >= 0 ? nextIndex : 0;
  renderAll();
}
function addClaim(label) {
  const annotation = currentAnnotation();
  annotation.claims.push({
    id: uid("claim"),
    label,
    colorIndex: annotation.claims.length % 10,
    text: "",
    evidences: [],
    createdAt: new Date().toISOString(),
  });
  if (annotation.status === "TODO" || !annotation.status) {
    annotation.status = "DONE";
  }
  saveAnnotations();
  renderAll();
}
function getContextFromSelection(selection) {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  const startEl =
    range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer
      : range.startContainer.parentElement;
  const endEl =
    range.endContainer.nodeType === Node.ELEMENT_NODE
      ? range.endContainer
      : range.endContainer.parentElement;
  const startContext = startEl?.closest?.(".context-body");
  const endContext = endEl?.closest?.(".context-body");
  if (!startContext || !endContext || startContext !== endContext) return null;
  return startContext;
}
function getRawOffset(container, targetNode, targetOffset) {
  let offset = 0;
  let found = false;

  function traverse(node) {
    if (found) return;
    
    if (node === targetNode) {
      if (node.nodeType === Node.TEXT_NODE) {
        offset += targetOffset;
      } else {
        for (let i = 0; i < targetOffset; i++) {
           if (node.childNodes[i]) {
               function sumLength(n) {
                  if (n.nodeType === Node.TEXT_NODE) return n.nodeValue.length;
                  if (n.nodeType === Node.ELEMENT_NODE && (n.classList.contains("evidence-tag") || n.classList.contains("evidence-tag-wrapper"))) return 0;
                  let sum = 0;
                  for (let c of n.childNodes) sum += sumLength(c);
                  return sum;
               }
               offset += sumLength(node.childNodes[i]);
           }
        }
      }
      found = true;
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      offset += node.nodeValue.length;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.classList.contains("evidence-tag-wrapper") || node.classList.contains("evidence-tag")) {
        return;
      }
      for (let i = 0; i < node.childNodes.length; i++) {
        traverse(node.childNodes[i]);
        if (found) return;
      }
    }
  }

  traverse(container);
  return offset;
}

function selectedOffsets(container, range) {
  const start = getRawOffset(container, range.startContainer, range.startOffset);
  const end = getRawOffset(container, range.endContainer, range.endOffset);
  return start < end ? { start, end } : { start: end, end: start };
}
function readSelection() {
  const selection = window.getSelection();
  const container = getContextFromSelection(selection);
  if (!container) return null;
  const range = selection.getRangeAt(0);
  const offsets = selectedOffsets(container, range);
  const contextId = container.dataset.context;
  const row = currentRow();
  const text = contextId === "A" ? row.contextA : row.contextB;
  const selectedText = text.slice(offsets.start, offsets.end).trim();
  if (!selectedText) return null;
  return {
    contextId,
    start: offsets.start,
    end: offsets.end,
    text: selectedText,
  };
}
function updateSelection(selectionRange = readSelection()) {
  state.selectedRange = selectionRange;
}
function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
function exportJson() {
  const payload = {
    source: state.sourceName,
    exportedAt: new Date().toISOString(),
    annotations: state.annotations,
  };
  downloadFile("multihop_annotations.json", JSON.stringify(payload, null, 2), "application/json");
}
function csvCell(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}
function exportCsv() {
  const rows = [
    [
      "sample_key",
      "row_number",
      "bridge_entity",
      "subject_entity",
      "claim_id",
      "claim_label",
      "claim_text",
      "evidence_id",
      "evidence_label",
      "evidence_tag",
      "context_id",
      "start",
      "end",
      "evidence_text",
    ],
  ];
  state.allRows.forEach((row) => {
    const annotation = state.annotations[row.key];
    if (!annotation) return;
    annotation.claims.forEach((claim) => {
      if (!claim.evidences.length) {
        rows.push([
          row.key,
          row.__rowNumber,
          row.bridge_entity,
          row.subject_entity,
          claim.id,
          claim.label,
          claim.text,
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ]);
        return;
      }
      claim.evidences.forEach((evidence) => {
        rows.push([
          row.key,
          row.__rowNumber,
          row.bridge_entity,
          row.subject_entity,
          claim.id,
          claim.label,
          claim.text,
          evidence.id,
          evidence.label,
          evidenceTag(claim, evidence),
          evidence.contextId,
          evidence.start,
          evidence.end,
          evidence.text,
        ]);
      });
    });
  });
  downloadFile("multihop_annotations.csv", rows.map((row) => row.map(csvCell).join(",")).join("\n"), "text/csv");
}
async function loadCsvText(text, name = "data.sample.csv") {
  state.sourceName = name;
  state.allRows = parseCsv(text);
  state.rows = [...state.allRows];
  state.currentIndex = 0;
  loadAnnotations();
  applyFilters();
}
async function loadDefaultCsv() {
  try {
    const response = await fetch("./data.sample.csv");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await loadCsvText(await response.text(), "data.sample.csv");
  } catch {
    state.allRows = [];
    state.rows = [];
    els.sampleMeta.textContent = "Hãy nạp file CSV";
    renderAll();
  }
}
els.csvInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  await loadCsvText(await file.text(), file.name);
});
els.exportJsonBtn.addEventListener("click", exportJson);
els.exportCsvBtn.addEventListener("click", exportCsv);
els.prevBtn.addEventListener("click", () => {
  state.currentIndex = Math.max(0, state.currentIndex - 1);
  renderAll();
});
els.nextBtn.addEventListener("click", () => {
  state.currentIndex = Math.min(state.rows.length - 1, state.currentIndex + 1);
  renderAll();
});
els.sampleIndex.addEventListener("change", () => {
  const target = Number.parseInt(els.sampleIndex.value, 10);
  if (!Number.isFinite(target)) return;
  state.currentIndex = Math.max(0, Math.min(state.rows.length - 1, target - 1));
  renderAll();
});
els.statusFilter.addEventListener("change", applyFilters);
els.searchInput.addEventListener("input", applyFilters);
if (els.rowStatusSelect) {
  els.rowStatusSelect.addEventListener("change", () => {
    const annotation = currentAnnotation();
    annotation.status = els.rowStatusSelect.value;
    saveAnnotations();
  });
}
if (els.showStatsBtn) els.showStatsBtn.addEventListener("click", showStatsModal);
if (els.closeStatsBtn) els.closeStatsBtn.addEventListener("click", hideStatsModal);
els.closeEvidenceBtn?.addEventListener("click", () => {
  els.evidenceModal.style.display = "none";
});
window.addEventListener("click", (e) => {
  if (e.target === els.statsModal) {
    hideStatsModal();
  }
  if (e.target === els.evidenceModal) {
    els.evidenceModal.style.display = "none";
  }
});
document.querySelectorAll("[data-add-claim]").forEach((button) => {
  button.addEventListener("click", () => addClaim(button.dataset.addClaim));
});
["mouseup", "keyup", "selectionchange"].forEach((eventName) => {
  document.addEventListener(eventName, () => {
    window.requestAnimationFrame(() => updateSelection());
  });
});
loadDefaultCsv();
