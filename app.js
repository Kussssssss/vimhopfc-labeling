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
  rowStatusContainer: document.getElementById("rowStatusContainer"),
  workspaceSplitter: document.getElementById("workspaceSplitter"),
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
  modelSettingsBtn: document.getElementById("modelSettingsBtn"),
  settingsModal: document.getElementById("settingsModal"),
  closeSettingsBtn: document.getElementById("closeSettingsBtn"),
  cfgBaseUrl: document.getElementById("cfgBaseUrl"),
  cfgApiKey: document.getElementById("cfgApiKey"),
  cfgModel: document.getElementById("cfgModel"),
  cfgInstruction: document.getElementById("cfgInstruction"),
  cfgTemperature: document.getElementById("cfgTemperature"),
  cfgTimeout: document.getElementById("cfgTimeout"),
  cfgTestResult: document.getElementById("cfgTestResult"),
  testModelBtn: document.getElementById("testModelBtn"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn"),
  verifyLoadingOverlay: document.getElementById("verifyLoadingOverlay"),
  verifyLoadingTitle: document.getElementById("verifyLoadingTitle"),
  verifyLoadingText: document.getElementById("verifyLoadingText"),
  verificationModal: document.getElementById("verificationModal"),
  closeVerificationBtn: document.getElementById("closeVerificationBtn"),
  verifySummary: document.getElementById("verifySummary"),
  verifyResults: document.getElementById("verifyResults"),
  verifyFooter: document.getElementById("verifyFooter"),
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
    const text = fragment.querySelector(".claim-text");
    const deleteBtn = fragment.querySelector(".delete-claim");
    const evidenceBox = fragment.querySelector(".claim-evidence");
    const addEvBtn = fragment.querySelector(".add-evidence-to-claim");
    const lockBtn = fragment.querySelector(".lock-claim-btn");
    const editBtn = fragment.querySelector(".edit-claim-btn");

    const isLocked = !!claim.locked;
    text.disabled = isLocked;
    
    if (isLocked) {
      if (addEvBtn) addEvBtn.style.display = "none";
      if (lockBtn) lockBtn.style.display = "none";
      if (editBtn) editBtn.style.display = "inline-flex";
      if (deleteBtn) deleteBtn.style.display = "none";
      card.classList.add("locked");
    } else {
      if (addEvBtn) addEvBtn.style.display = "inline-flex";
      if (lockBtn) lockBtn.style.display = "inline-flex";
      if (editBtn) editBtn.style.display = "none";
      if (deleteBtn) deleteBtn.style.display = "inline-flex";
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
        if (annotation.status === "DONE") {
          annotation.status = "EDIT";
        }
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
    if (addEvBtn) {
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
    }
    card.dataset.label = claim.label;
    card.style.borderLeftColor = `rgb(${colorRgb})`;
    title.textContent = `Câu ${claim.label} ${claimOrdinal(claim)}`;
    text.value = claim.text || "";
    text.addEventListener("input", () => {
      claim.text = text.value;
      saveAnnotations();
    });
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => {
        annotation.claims = annotation.claims.filter((item) => item.id !== claim.id);
        saveAnnotations();
        renderAll();
      });
    }
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


function renderStatusSection() {
  const annotation = currentAnnotation();
  if (!els.rowStatusContainer) return;

  els.rowStatusContainer.innerHTML = "";

  const hasClaims = annotation.claims && annotation.claims.length > 0;
  const allClaimsLocked = hasClaims && annotation.claims.every(c => c.locked);

  if (annotation.status === "DONE") {
    els.rowStatusContainer.innerHTML = `
      <div class="submitted-status-wrapper">
        <span class="submitted-badge">✅ Đã hoàn thành</span>
        <button id="revertSubmitBtn" class="revert-submit-btn" type="button">Sửa lại</button>
      </div>
    `;
    document.getElementById("revertSubmitBtn").addEventListener("click", () => {
      annotation.status = "EDIT";
      saveAnnotations();
      renderAll();
    });
  } else if (hasClaims && allClaimsLocked) {
    els.rowStatusContainer.innerHTML = `
      <button id="submitSampleBtn" class="submit-sample-btn" type="button">✅ Submit (Kiểm chứng one-hop)</button>
    `;
    document.getElementById("submitSampleBtn").addEventListener("click", () => {
      runVerificationAndSubmit(currentRow(), annotation);
    });
  } else {
    const select = document.createElement("select");
    select.id = "rowStatusSelect";
    select.className = "status-select";
    select.innerHTML = `
      <option value="TODO">⏳ Chưa làm</option>
      <option value="EDIT">⚠️ Cần chỉnh sửa</option>
      <option value="SKIP">🚫 Bỏ qua</option>
    `;
    select.value = annotation.status || "TODO";
    select.addEventListener("change", () => {
      annotation.status = select.value;
      saveAnnotations();
    });
    els.rowStatusContainer.appendChild(select);
  }
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
    renderStatusSection();
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
  renderStatusSection();
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
function getOriginalTextOffset(container, targetNode, targetOffset) {
  let offset = 0;
  let found = false;

  function traverse(node) {
    if (found) return;
    
    if (node.nodeType === Node.ELEMENT_NODE && 
        node.classList && 
        (node.classList.contains("evidence-tag") || node.classList.contains("evidence-tag-wrapper"))) {
      if (node === targetNode || node.contains(targetNode)) {
        found = true;
      }
      return;
    }

    if (node === targetNode) {
      if (node.nodeType === Node.TEXT_NODE) {
        offset += targetOffset;
      } else {
        for (let i = 0; i < targetOffset; i++) {
           if (node.childNodes[i]) {
               function sumLength(n) {
                  if (n.nodeType === Node.TEXT_NODE) return n.nodeValue.length;
                  if (n.nodeType === Node.ELEMENT_NODE && 
                      n.classList && 
                      (n.classList.contains("evidence-tag") || n.classList.contains("evidence-tag-wrapper"))) {
                    return 0;
                  }
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
  const start = getOriginalTextOffset(container, range.startContainer, range.startOffset);
  const end = getOriginalTextOffset(container, range.endContainer, range.endOffset);
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
// Removed rowStatusSelect change event listener (now dynamic)
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
/* ============================================================
 * Custom Model API — one-hop fact-checking verification
 * ============================================================ */
const MODEL_CFG_KEY = "mh-labeler:model-config";
const VERIFY_LABELS = ["SUP", "REFUTE"]; // chỉ kiểm tra SUP/REFUTE; NEI bỏ qua
const DEFAULT_MODEL_CFG = {
  baseUrl: "https://<workspace>--gemma-unsloth-api.modal.run/v1",
  apiKey: "empty",
  model: "tranthaihoa/gemma-7b-finetuned-awq",
  instruction:
    "Bạn là hệ thống fact-checking. Chỉ dựa vào phần Ngữ cảnh trong Input bên dưới, " +
    "hãy phân loại claim thành đúng MỘT nhãn: SUP, REFUTE, hoặc NEI. " +
    "SUP nếu ngữ cảnh đủ thông tin để khẳng định claim đúng; " +
    "REFUTE nếu ngữ cảnh mâu thuẫn với claim; " +
    "NEI nếu ngữ cảnh không đủ thông tin để kết luận. " +
    "Chỉ trả lời bằng một từ duy nhất: SUP, REFUTE hoặc NEI.",
  temperature: 0,
  timeoutMs: 60000,
};

function loadModelConfig() {
  try {
    return { ...DEFAULT_MODEL_CFG, ...JSON.parse(localStorage.getItem(MODEL_CFG_KEY) || "{}") };
  } catch {
    return { ...DEFAULT_MODEL_CFG };
  }
}
function saveModelConfig(cfg) {
  localStorage.setItem(MODEL_CFG_KEY, JSON.stringify(cfg));
}
function isModelConfigured(cfg = loadModelConfig()) {
  const url = (cfg.baseUrl || "").trim();
  return !!url && !url.includes("<workspace>");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]),
  );
}

function alpacaPrompt(instruction, input) {
  return `Below is an instruction that describes a task, paired with an input that provides further context. Write a response that appropriately completes the request.

### Instruction:
${instruction}

### Input:
${input}

### Response:
`;
}

function parseLabel(text) {
  const match = String(text || "").toUpperCase().match(/\b(SUP|REFUTE|NEI)\b/);
  return match ? match[1] : null;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`Hết thời gian chờ (${Math.round(timeoutMs / 1000)}s)`);
    }
    throw new Error(`Không gọi được API (kiểm tra URL / CORS): ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

async function modelPredict(instruction, inputText, cfg) {
  const base = (cfg.baseUrl || "").trim().replace(/\/+$/, "");
  const res = await fetchWithTimeout(
    `${base}/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: cfg.model,
        prompt: alpacaPrompt(instruction, inputText),
        max_tokens: 16,
        temperature: Number(cfg.temperature) || 0,
        stop: ["<eos>", "###"],
      }),
    },
    Number(cfg.timeoutMs) || 60000,
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}${body ? `: ${body.slice(0, 120)}` : ""}`);
  }
  const data = await res.json();
  const raw = (data.choices?.[0]?.text ?? "").trim();
  return { label: parseLabel(raw), raw };
}

function buildCheckInput(contextText, claimText) {
  return `Ngữ cảnh:\n${contextText}\n\nCâu cần kiểm tra (claim):\n${claimText}`;
}

// Kiểm tra 1 claim qua tối đa 3 bước. PASS = model trượt cả 3 bước.
async function verifyClaim(row, claim, cfg, onStep) {
  const target = String(claim.label || "").toUpperCase();
  onStep?.("Chỉ Context A");
  const A = await modelPredict(cfg.instruction, buildCheckInput(row.contextA, claim.text), cfg);
  const leakedA = A.label === target;

  onStep?.("Chỉ Context B");
  const B = await modelPredict(cfg.instruction, buildCheckInput(row.contextB, claim.text), cfg);
  const leakedB = B.label === target;

  let AB = null;
  let solvedAB = false;
  if (!leakedA && !leakedB) {
    onStep?.("Context A + B");
    AB = await modelPredict(
      cfg.instruction,
      buildCheckInput(`${row.contextA}\n\n${row.contextB}`, claim.text),
      cfg,
    );
    solvedAB = AB.label === target;
  }

  const pass = !leakedA && !leakedB && !solvedAB;
  return { claimId: claim.id, label: target, text: claim.text, A, B, AB, leakedA, leakedB, solvedAB, pass };
}

function showVerifyLoading(show) {
  if (els.verifyLoadingOverlay) els.verifyLoadingOverlay.style.display = show ? "flex" : "none";
}
function setVerifyLoading(title, text) {
  if (els.verifyLoadingTitle) els.verifyLoadingTitle.textContent = title;
  if (els.verifyLoadingText) {
    els.verifyLoadingText.textContent = text || "Lần gọi đầu có thể mất 15–20s để bật GPU.";
  }
}

async function runVerificationAndSubmit(row, annotation) {
  if (!row || !annotation) return;
  const cfg = loadModelConfig();

  if (!isModelConfigured(cfg)) {
    const proceed = window.confirm(
      "Chưa cấu hình Model API (nút ⚙️ Model).\n\nBấm OK để Submit mà KHÔNG kiểm chứng one-hop, hoặc Cancel để mở cấu hình.",
    );
    if (proceed) {
      annotation.status = "DONE";
      saveAnnotations();
      renderAll();
    } else {
      openSettingsModal();
    }
    return;
  }

  const targets = annotation.claims.filter(
    (c) => VERIFY_LABELS.includes(String(c.label).toUpperCase()) && (c.text || "").trim(),
  );

  if (!targets.length) {
    annotation.status = "DONE";
    saveAnnotations();
    renderAll();
    return;
  }

  showVerifyLoading(true);
  const results = [];
  let errored = null;
  try {
    for (let i = 0; i < targets.length; i += 1) {
      const claim = targets[i];
      const head = `Đang kiểm tra claim ${i + 1}/${targets.length} · ${claim.label}`;
      setVerifyLoading(head, "");
      // eslint-disable-next-line no-await-in-loop
      const result = await verifyClaim(row, claim, cfg, (step) => setVerifyLoading(head, `Bước: ${step}`));
      results.push(result);
    }
  } catch (err) {
    errored = err;
  }
  showVerifyLoading(false);

  if (errored) {
    showVerificationError(errored, row, annotation);
    return;
  }

  annotation.verification = {
    checkedAt: new Date().toISOString(),
    results: results.map((r) => ({
      claimId: r.claimId,
      label: r.label,
      pass: r.pass,
      leakedA: r.leakedA,
      leakedB: r.leakedB,
      solvedAB: r.solvedAB,
      predA: r.A.label,
      predB: r.B.label,
      predAB: r.AB?.label ?? null,
    })),
  };

  const allPass = results.every((r) => r.pass);
  annotation.status = allPass ? "DONE" : "EDIT";
  saveAnnotations();
  showVerificationResults(results, row, annotation, allPass);
  renderAll();
}

function verifyStepHtml(name, predLabel, target, bad) {
  const pred = predLabel || "—";
  const verdict = bad
    ? `model đoán đúng nhãn "${escapeHtml(target)}" → bị lộ`
    : `model đoán "${escapeHtml(pred)}" ≠ "${escapeHtml(target)}" → ổn`;
  return `
    <div class="verify-step ${bad ? "bad" : "good"}">
      <span class="step-name">${escapeHtml(name)}</span>
      <span class="step-pred">model: <b>${escapeHtml(pred)}</b></span>
      <span class="step-verdict">${verdict}</span>
    </div>`;
}

function showVerificationResults(results, row, annotation, allPass) {
  const leakCount = results.filter((r) => !r.pass).length;
  els.verifySummary.className = "verify-summary " + (allPass ? "ok" : "warn");
  els.verifySummary.innerHTML = allPass
    ? `✅ Tất cả ${results.length} claim đạt: model single-hop <b>không</b> suy ra được nhãn ở cả 3 bước. Sample đã được đánh dấu <b>Đã hoàn thành</b>.`
    : `⚠️ ${leakCount}/${results.length} claim bị "lộ" qua single-hop. Sample được chuyển sang <b>Cần chỉnh sửa</b>. Nên sửa lại claim hoặc bổ sung hop suy luận.`;

  els.verifyResults.innerHTML = "";
  results.forEach((r) => {
    const card = document.createElement("div");
    card.className = "verify-claim " + (r.pass ? "pass" : "leak");
    const steps = [
      verifyStepHtml("Chỉ Context A", r.A.label, r.label, r.leakedA),
      verifyStepHtml("Chỉ Context B", r.B.label, r.label, r.leakedB),
    ];
    if (r.AB) steps.push(verifyStepHtml("Context A + B", r.AB.label, r.label, r.solvedAB));
    card.innerHTML = `
      <div class="verify-claim-head">
        <span class="verify-verdict">${r.pass ? "✅ ĐẠT" : "⚠️ BỊ LỘ"}</span>
        <span class="verify-claim-label" data-label="${escapeHtml(r.label)}">${escapeHtml(r.label)}</span>
      </div>
      <div class="verify-claim-text">${escapeHtml(r.text)}</div>
      <div class="verify-steps">${steps.join("")}</div>`;
    els.verifyResults.append(card);
  });

  els.verifyFooter.innerHTML = "";
  if (allPass) {
    const ok = document.createElement("button");
    ok.className = "primary";
    ok.type = "button";
    ok.textContent = "Đóng";
    ok.addEventListener("click", () => {
      els.verificationModal.style.display = "none";
    });
    els.verifyFooter.append(ok);
  } else {
    const force = document.createElement("button");
    force.type = "button";
    force.textContent = "Vẫn submit (đè cảnh báo)";
    force.addEventListener("click", () => {
      annotation.status = "DONE";
      saveAnnotations();
      els.verificationModal.style.display = "none";
      renderAll();
    });
    const fix = document.createElement("button");
    fix.className = "primary";
    fix.type = "button";
    fix.textContent = "Để tôi sửa lại";
    fix.addEventListener("click", () => {
      els.verificationModal.style.display = "none";
    });
    els.verifyFooter.append(force, fix);
  }
  els.verificationModal.style.display = "flex";
}

function showVerificationError(err, row, annotation) {
  els.verifySummary.className = "verify-summary error";
  els.verifySummary.textContent =
    `❌ Lỗi gọi model: ${err.message}. Kiểm tra Base URL / CORS / GPU rồi thử lại. Bạn vẫn có thể submit thủ công.`;
  els.verifyResults.innerHTML = "";
  els.verifyFooter.innerHTML = "";

  const retry = document.createElement("button");
  retry.className = "primary";
  retry.type = "button";
  retry.textContent = "Thử lại";
  retry.addEventListener("click", () => {
    els.verificationModal.style.display = "none";
    runVerificationAndSubmit(row, annotation);
  });

  const cfgBtn = document.createElement("button");
  cfgBtn.type = "button";
  cfgBtn.textContent = "⚙️ Cấu hình";
  cfgBtn.addEventListener("click", () => {
    els.verificationModal.style.display = "none";
    openSettingsModal();
  });

  const manual = document.createElement("button");
  manual.type = "button";
  manual.textContent = "Submit không kiểm chứng";
  manual.addEventListener("click", () => {
    annotation.status = "DONE";
    saveAnnotations();
    els.verificationModal.style.display = "none";
    renderAll();
  });

  els.verifyFooter.append(retry, cfgBtn, manual);
  els.verificationModal.style.display = "flex";
}

/* ---------- Settings modal ---------- */
function openSettingsModal() {
  const cfg = loadModelConfig();
  els.cfgBaseUrl.value = cfg.baseUrl;
  els.cfgApiKey.value = cfg.apiKey;
  els.cfgModel.value = cfg.model;
  els.cfgInstruction.value = cfg.instruction;
  els.cfgTemperature.value = cfg.temperature;
  els.cfgTimeout.value = cfg.timeoutMs;
  els.cfgTestResult.textContent = "";
  els.cfgTestResult.className = "cfg-test-result";
  els.settingsModal.style.display = "flex";
}

function readSettingsForm() {
  return {
    baseUrl: els.cfgBaseUrl.value.trim(),
    apiKey: els.cfgApiKey.value.trim(),
    model: els.cfgModel.value.trim(),
    instruction: els.cfgInstruction.value.trim() || DEFAULT_MODEL_CFG.instruction,
    temperature: Number(els.cfgTemperature.value) || 0,
    timeoutMs: Number(els.cfgTimeout.value) || 60000,
  };
}

function saveSettings() {
  saveModelConfig(readSettingsForm());
  els.settingsModal.style.display = "none";
}

async function testModelConnection() {
  const cfg = readSettingsForm();
  if (!isModelConfigured(cfg)) {
    els.cfgTestResult.className = "cfg-test-result error";
    els.cfgTestResult.textContent = "❌ Base URL chưa hợp lệ (còn chứa <workspace> hoặc để trống).";
    return;
  }
  els.cfgTestResult.className = "cfg-test-result testing";
  els.cfgTestResult.textContent = "Đang gọi thử (có thể mất 15–20s nếu GPU đang ngủ)…";
  try {
    const sample = "Hà Nội là thủ đô của Việt Nam.";
    const r = await modelPredict(cfg.instruction, buildCheckInput(sample, sample), cfg);
    els.cfgTestResult.className = "cfg-test-result ok";
    els.cfgTestResult.textContent = r.label
      ? `✅ Kết nối OK. Nhãn parse được: ${r.label}`
      : `✅ Kết nối OK nhưng chưa parse được nhãn. Output thô: "${r.raw.slice(0, 80)}"`;
  } catch (err) {
    els.cfgTestResult.className = "cfg-test-result error";
    els.cfgTestResult.textContent = `❌ Lỗi: ${err.message}`;
  }
}

if (els.modelSettingsBtn) els.modelSettingsBtn.addEventListener("click", openSettingsModal);
if (els.closeSettingsBtn) {
  els.closeSettingsBtn.addEventListener("click", () => {
    els.settingsModal.style.display = "none";
  });
}
if (els.saveSettingsBtn) els.saveSettingsBtn.addEventListener("click", saveSettings);
if (els.testModelBtn) els.testModelBtn.addEventListener("click", testModelConnection);
if (els.closeVerificationBtn) {
  els.closeVerificationBtn.addEventListener("click", () => {
    els.verificationModal.style.display = "none";
  });
}
window.addEventListener("click", (e) => {
  if (e.target === els.settingsModal) els.settingsModal.style.display = "none";
  if (e.target === els.verificationModal) els.verificationModal.style.display = "none";
});

function initSplitter() {
  const splitter = els.workspaceSplitter;
  const rightPane = document.querySelector(".right-pane");
  const workspace = document.querySelector(".workspace");
  if (!splitter || !rightPane || !workspace) return;

  let isDragging = false;

  splitter.addEventListener("mousedown", (e) => {
    isDragging = true;
    splitter.classList.add("dragging");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const workspaceRect = workspace.getBoundingClientRect();
    const newWidth = workspaceRect.right - e.clientX - 10;
    if (newWidth >= 280 && newWidth <= 600) {
      rightPane.style.width = `${newWidth}px`;
      localStorage.setItem("mh-labeler:splitter-width", newWidth);
    }
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      splitter.classList.remove("dragging");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  });

  const savedWidth = localStorage.getItem("mh-labeler:splitter-width");
  if (savedWidth) {
    const w = parseInt(savedWidth, 10);
    if (w >= 280 && w <= 600) {
      rightPane.style.width = `${w}px`;
    }
  }
}

initSplitter();
loadDefaultCsv();
