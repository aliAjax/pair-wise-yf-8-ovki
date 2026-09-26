const storageKey = "zfl17-film-strip-desk";

const fallbackThumbs = ["#d49b35", "#347d89", "#b54d48", "#4d7656", "#6d6378"];
const lowThreshold = 3; // 剩余场次不超过该值时进入提醒

const defaultState = {
  reelTitle: "春日试映A卷",
  segments: [
    {
      id: crypto.randomUUID(),
      code: "A-001",
      duration: 18,
      shift: "正常",
      damage: "完好",
      note: "开场街景，节奏平稳，适合保留原顺序。",
      thumb: "",
      limit: 20,
      used: 5,
      reserved: 2
    },
    {
      id: crypto.randomUUID(),
      code: "A-006",
      duration: 9,
      shift: "偏红",
      damage: "轻微划痕",
      note: "人物近景左侧有划痕，试映时留意是否明显。",
      thumb: "",
      limit: 8,
      used: 5,
      reserved: 3
    },
    {
      id: crypto.randomUUID(),
      code: "A-012",
      duration: 14,
      shift: "褪色",
      damage: "接片松动",
      note: "接片位置靠近段尾，放映前建议重新压平。",
      thumb: "",
      limit: 12,
      used: 1,
      reserved: 0
    }
  ],
  archive: []
};

let state = loadState();
let draggedId = null;
let replaceTargetId = null;
let toastTimer = null;

const els = {
  reelTitle: document.querySelector("#reelTitle"),
  colorFilter: document.querySelector("#colorFilter"),
  searchInput: document.querySelector("#searchInput"),
  segmentForm: document.querySelector("#segmentForm"),
  codeInput: document.querySelector("#codeInput"),
  durationInput: document.querySelector("#durationInput"),
  limitInput: document.querySelector("#limitInput"),
  shiftInput: document.querySelector("#shiftInput"),
  damageInput: document.querySelector("#damageInput"),
  thumbInput: document.querySelector("#thumbInput"),
  noteInput: document.querySelector("#noteInput"),
  segmentList: document.querySelector("#segmentList"),
  archiveList: document.querySelector("#archiveList"),
  warningList: document.querySelector("#warningList"),
  totalDuration: document.querySelector("#totalDuration"),
  damageCount: document.querySelector("#damageCount"),
  exhaustedCount: document.querySelector("#exhaustedCount"),
  segmentCount: document.querySelector("#segmentCount"),
  exportBtn: document.querySelector("#exportBtn"),
  toast: document.querySelector("#toast"),
  replaceModal: document.querySelector("#replaceModal"),
  replaceForm: document.querySelector("#replaceForm"),
  replaceCarry: document.querySelector("#replaceCarry"),
  replaceCode: document.querySelector("#replaceCode"),
  replaceDuration: document.querySelector("#replaceDuration"),
  replaceLimit: document.querySelector("#replaceLimit"),
  replaceShift: document.querySelector("#replaceShift"),
  replaceDamage: document.querySelector("#replaceDamage"),
  replaceNote: document.querySelector("#replaceNote"),
  replaceCancel: document.querySelector("#replaceCancel")
};

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return structuredClone(defaultState);
  try {
    const parsed = JSON.parse(saved);
    const merged = { ...structuredClone(defaultState), ...parsed };
    // 预订（reserved）与已用（used）始终分开计数，旧数据补齐台账字段
    merged.segments = (merged.segments || []).map(normalizeLedger);
    merged.archive = (merged.archive || []).map(normalizeLedger);
    return merged;
  } catch {
    return structuredClone(defaultState);
  }
}

function normalizeLedger(item) {
  return {
    ...item,
    limit: Math.max(0, Number(item.limit) || 0),
    used: Math.max(0, Number(item.used) || 0),
    reserved: Math.max(0, Number(item.reserved) || 0),
    replacedAt: item.replacedAt || ""
  };
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

// 剩余可放场次 = 安全上限 - 已用 - 已预订占用
function remaining(item) {
  return Math.max(0, item.limit - item.used - item.reserved);
}

function getFilteredSegments() {
  const color = els.colorFilter.value;
  const keyword = els.searchInput.value.trim();
  return state.segments.filter((item) => {
    const matchesColor = color === "all" || item.shift === color;
    const matchesKeyword = !keyword || `${item.code}${item.note}${item.damage}`.includes(keyword);
    return matchesColor && matchesKeyword;
  });
}

function renderStats() {
  const total = state.segments.reduce((sum, item) => sum + Number(item.duration), 0);
  const damaged = state.segments.filter((item) => item.damage !== "完好").length;
  const exhausted = state.segments.filter((item) => remaining(item) <= lowThreshold).length;
  els.totalDuration.textContent = formatDuration(total);
  els.damageCount.textContent = damaged;
  els.exhaustedCount.textContent = exhausted;
  els.segmentCount.textContent = state.segments.length;
}

function ledgerClass(item) {
  const left = remaining(item);
  if (left === 0) return "danger";
  if (left <= lowThreshold) return "warn";
  return "ok";
}

function renderList() {
  const segments = getFilteredSegments();
  els.segmentList.innerHTML =
    segments
      .map((item, index) => {
        const realIndex = state.segments.findIndex((segment) => segment.id === item.id);
        const hasDamage = item.damage !== "完好";
        const left = remaining(item);
        const status = ledgerClass(item);
        const maxBook = Math.max(1, left);
        return `
          <article class="segment-card" draggable="true" data-id="${item.id}">
            <div class="thumb">
              ${
                item.thumb
                  ? `<img src="${item.thumb}" alt="${escapeHtml(item.code)}缩略图" />`
                  : `<div class="film-placeholder" style="background:${fallbackThumbs[realIndex % fallbackThumbs.length]}">${escapeHtml(item.code)}</div>`
              }
            </div>
            <div class="segment-main">
              <div class="segment-title">
                <strong>${realIndex + 1}. ${escapeHtml(item.code)}</strong>
                <span>${formatDuration(item.duration)}</span>
              </div>
              <div class="tag-row">
                <span class="tag">${escapeHtml(item.shift)}</span>
                <span class="tag ${hasDamage ? "damage" : "ok"}">${escapeHtml(item.damage)}</span>
              </div>
              <div class="ledger ${status}">
                <span class="ledger-remain">
                  剩余可放 <strong>${left}</strong> 场
                </span>
                <span class="ledger-detail">
                  上限 ${item.limit} ｜ 已映 ${item.used} ｜ 已订 ${item.reserved}
                </span>
              </div>
              <div class="booking-row">
                <input
                  type="number"
                  min="1"
                  max="${maxBook}"
                  value="1"
                  aria-label="预订场次数"
                  data-qty="${item.id}"
                  ${left === 0 ? "disabled" : ""}
                />
                <button type="button" data-book="${item.id}" ${left === 0 ? "disabled" : ""}>预订占用</button>
                <button type="button" data-cancel="${item.id}" ${item.reserved === 0 ? "disabled" : ""}>取消预订</button>
                <button type="button" class="primary" data-complete="${item.id}" ${item.reserved === 0 ? "disabled" : ""}>完成放映</button>
              </div>
              <p class="segment-note">${escapeHtml(item.note || "没有备注。")}</p>
            </div>
            <div class="segment-actions">
              <button type="button" title="上移" data-move-up="${item.id}">↑</button>
              <button type="button" title="下移" data-move-down="${item.id}">↓</button>
              <button type="button" title="替换片段" data-replace="${item.id}">换</button>
              <button type="button" title="删除" data-delete="${item.id}">×</button>
            </div>
          </article>
        `;
      })
      .join("") || `<p class="empty">没有符合筛选的片段。</p>`;

  renderArchive();
}

function renderArchive() {
  if (!state.archive.length) {
    els.archiveList.innerHTML = `<p class="empty">还没有被替换下片的片段。</p>`;
    return;
  }
  els.archiveList.innerHTML = state.archive
    .map((item) => {
      const summary = item.reserved
        ? `已映 ${item.used}（另有 ${item.reserved} 场未用预订已随替换转走）`
        : `已映 ${item.used}`;
      return `
        <div class="archive-item">
          <div>
            <strong>${escapeHtml(item.code)}</strong>
            <span>${summary}${item.replacedAt ? ` · ${escapeHtml(item.replacedAt)}` : ""}</span>
          </div>
          <button type="button" title="删除该历史记录" data-archive-delete="${item.id}">×</button>
        </div>
      `;
    })
    .join("");
}

function renderWarnings() {
  // 提醒一律按剩余次数（上限 - 已用 - 预订）展示
  const tight = state.segments
    .filter((item) => remaining(item) <= lowThreshold)
    .sort((a, b) => remaining(a) - remaining(b));
  const physical = state.segments.filter((item) => item.damage !== "完好" || item.shift !== "正常");

  const sections = [];

  if (tight.length) {
    sections.push(`
      <div class="warning-group">
        <h3>场次余量</h3>
        ${tight
          .map((item) => {
            const index = state.segments.findIndex((segment) => segment.id === item.id) + 1;
            const left = remaining(item);
            const text =
              left === 0
                ? `已无可放场次（上限 ${item.limit}，已映 ${item.used}，已订 ${item.reserved}），不能再预订或放映。`
                : `仅剩 ${left} 场可放（上限 ${item.limit}，已映 ${item.used}，已订 ${item.reserved}）。`;
            return `
              <div class="warning-item ${left === 0 ? "critical" : ""}">
                <strong>${index}. ${escapeHtml(item.code)}</strong>
                <span>${text}</span>
              </div>
            `;
          })
          .join("")}
      </div>
    `);
  }

  if (physical.length) {
    sections.push(`
      <div class="warning-group">
        <h3>画面与破损</h3>
        ${physical
          .map((item) => {
            const index = state.segments.findIndex((segment) => segment.id === item.id) + 1;
            const reasons = [item.shift !== "正常" ? item.shift : "", item.damage !== "完好" ? item.damage : ""].filter(Boolean).join(" · ");
            return `
              <div class="warning-item">
                <strong>${index}. ${escapeHtml(item.code)}</strong>
                <span>${escapeHtml(reasons)}${item.note ? `：${escapeHtml(item.note)}` : ""}</span>
              </div>
            `;
          })
          .join("")}
      </div>
    `);
  }

  els.warningList.innerHTML =
    sections.join("") || `<p class="empty">当前清单没有场次余量、颜色偏移或破损提醒。</p>`;
}

function renderAll() {
  saveState();
  els.reelTitle.value = state.reelTitle;
  renderStats();
  renderList();
  renderWarnings();
}

function showToast(message, tone = "ok") {
  els.toast.textContent = message;
  els.toast.className = `toast ${tone}`;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.hidden = true;
  }, 3200);
}

function readQty(id) {
  const input = els.segmentList.querySelector(`[data-qty="${id}"]`);
  const qty = Math.floor(Number(input?.value));
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

function findSegment(id) {
  return state.segments.find((item) => item.id === id);
}

// 预订：先占用剩余次数；余量不足则挡住并指出短片编号与差口
function bookSegment(id) {
  const item = findSegment(id);
  if (!item) return;
  const qty = readQty(id);
  const left = remaining(item);
  if (qty > left) {
    showToast(
      `预订被挡住：短片 ${item.code} 仅剩 ${left} 场可放，无法预订 ${qty} 场（还差 ${qty - left} 场）。`,
      "error"
    );
    return;
  }
  item.reserved += qty;
  showToast(`已为 ${item.code} 预订 ${qty} 场，占用后剩余 ${remaining(item)} 场。`);
  renderAll();
}

// 取消预订：释放占用，不动已用记录
function cancelReservation(id) {
  const item = findSegment(id);
  if (!item) return;
  const qty = Math.min(readQty(id), item.reserved);
  if (qty <= 0) {
    showToast(`短片 ${item.code} 没有可取消的预订。`, "error");
    return;
  }
  item.reserved -= qty;
  showToast(`已取消 ${item.code} 的 ${qty} 场预订，释放后剩余 ${remaining(item)} 场。`);
  renderAll();
}

// 实际完成放映：把已预订的占用转为已用
function completeScreening(id) {
  const item = findSegment(id);
  if (!item) return;
  const qty = Math.min(readQty(id), item.reserved);
  if (qty <= 0) {
    showToast(`短片 ${item.code} 没有待完成的预订，先预订再登记放映。`, "error");
    return;
  }
  item.reserved -= qty;
  item.used += qty;
  showToast(`${item.code} 完成 ${qty} 场放映，已转为已用，剩余 ${remaining(item)} 场。`);
  renderAll();
}

function openReplaceModal(id) {
  const item = findSegment(id);
  if (!item) return;
  replaceTargetId = id;
  els.replaceCarry.textContent = item.reserved;
  els.replaceCode.value = item.code;
  els.replaceDuration.value = item.duration;
  els.replaceLimit.value = item.limit;
  els.replaceShift.value = item.shift;
  els.replaceDamage.value = item.damage;
  els.replaceNote.value = "";
  els.replaceModal.hidden = false;
  els.replaceCode.focus();
}

function closeReplaceModal() {
  replaceTargetId = null;
  els.replaceModal.hidden = true;
}

// 替换片段：尚未使用的预订（reserved）转给新片段；已完成（used）留在旧片段归档
function confirmReplace(event) {
  event.preventDefault();
  const old = findSegment(replaceTargetId);
  if (!old) {
    closeReplaceModal();
    return;
  }
  const limit = Math.floor(Number(els.replaceLimit.value));
  const carry = old.reserved;
  if (!Number.isFinite(limit) || limit < carry) {
    showToast(
      `新片段安全上限至少要能承接 ${carry} 场未用预订，请把上限调到不小于 ${carry}。`,
      "error"
    );
    return;
  }
  const index = state.segments.findIndex((item) => item.id === old.id);
  const replacement = {
    id: crypto.randomUUID(),
    code: els.replaceCode.value.trim(),
    duration: Number(els.replaceDuration.value),
    shift: els.replaceShift.value,
    damage: els.replaceDamage.value,
    note: els.replaceNote.value.trim(),
    thumb: "",
    limit,
    used: 0,
    reserved: carry
  };
  state.segments.splice(index, 1, replacement);
  state.archive.push({
    ...old,
    reserved: 0, // 未用预订已全部转走，归档只保留已完成记录
    replacedAt: new Date().toLocaleString("zh-CN", { hour12: false })
  });
  closeReplaceModal();
  showToast(
    carry
      ? `已替换为 ${replacement.code}，旧片段 ${carry} 场未用预订已转来；旧片段已映 ${old.used} 场留在历史台账。`
      : `已替换为 ${replacement.code}；旧片段没有未用预订，已映 ${old.used} 场留在历史台账。`
  );
  renderAll();
}

function formatDuration(seconds) {
  const value = Number(seconds) || 0;
  const minutes = Math.floor(value / 60);
  const rest = String(value % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

async function addSegment(event) {
  event.preventDefault();
  const thumb = await readFileAsDataUrl(els.thumbInput.files[0]);
  state.segments.push({
    id: crypto.randomUUID(),
    code: els.codeInput.value.trim(),
    duration: Number(els.durationInput.value),
    shift: els.shiftInput.value,
    damage: els.damageInput.value,
    note: els.noteInput.value.trim(),
    thumb,
    limit: Math.max(1, Math.floor(Number(els.limitInput.value)) || 20),
    used: 0,
    reserved: 0
  });
  els.segmentForm.reset();
  els.durationInput.value = 12;
  els.limitInput.value = 20;
  renderAll();
}

function moveSegment(id, direction) {
  const index = state.segments.findIndex((item) => item.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= state.segments.length) return;
  const [item] = state.segments.splice(index, 1);
  state.segments.splice(target, 0, item);
  renderAll();
}

function exportList() {
  const lines = [
    `胶片卷：${state.reelTitle || "未命名胶片卷"}`,
    `总时长：${formatDuration(state.segments.reduce((sum, item) => sum + Number(item.duration), 0))}`,
    "",
    ...state.segments.map((item, index) => {
      return [
        `${index + 1}. ${item.code}`,
        formatDuration(item.duration),
        item.shift,
        item.damage,
        `上限${item.limit}`,
        `已映${item.used}`,
        `已订${item.reserved}`,
        `剩余${remaining(item)}`,
        item.note || "无备注"
      ].join("｜");
    })
  ];

  if (state.archive.length) {
    lines.push("", "已替换片段 · 历史台账（仅已完成记录）");
    state.archive.forEach((item, index) => {
      lines.push(
        `${index + 1}. ${item.code}｜上限${item.limit}｜已映${item.used}${
          item.replacedAt ? `｜替换于 ${item.replacedAt}` : ""
        }`
      );
    });
  }

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${state.reelTitle || "film-reel"}-checklist.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

els.reelTitle.addEventListener("input", () => {
  state.reelTitle = els.reelTitle.value;
  saveState();
});
els.colorFilter.addEventListener("change", renderList);
els.searchInput.addEventListener("input", renderList);
els.segmentForm.addEventListener("submit", addSegment);
els.exportBtn.addEventListener("click", exportList);

els.segmentList.addEventListener("click", (event) => {
  const book = event.target.closest("[data-book]");
  const cancel = event.target.closest("[data-cancel]");
  const complete = event.target.closest("[data-complete]");
  const replace = event.target.closest("[data-replace]");
  const up = event.target.closest("[data-move-up]");
  const down = event.target.closest("[data-move-down]");
  const remove = event.target.closest("[data-delete]");
  if (book) bookSegment(book.dataset.book);
  if (cancel) cancelReservation(cancel.dataset.cancel);
  if (complete) completeScreening(complete.dataset.complete);
  if (replace) openReplaceModal(replace.dataset.replace);
  if (up) moveSegment(up.dataset.moveUp, -1);
  if (down) moveSegment(down.dataset.moveDown, 1);
  if (remove) {
    state.segments = state.segments.filter((item) => item.id !== remove.dataset.delete);
    renderAll();
  }
});

els.archiveList.addEventListener("click", (event) => {
  const remove = event.target.closest("[data-archive-delete]");
  if (!remove) return;
  state.archive = state.archive.filter((item) => item.id !== remove.dataset.archiveDelete);
  renderAll();
});

els.segmentList.addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-id]");
  if (!card) return;
  draggedId = card.dataset.id;
  card.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
});

els.segmentList.addEventListener("dragend", (event) => {
  event.target.closest("[data-id]")?.classList.remove("dragging");
  draggedId = null;
});

els.segmentList.addEventListener("dragover", (event) => {
  const card = event.target.closest("[data-id]");
  if (!card || !draggedId || card.dataset.id === draggedId) return;
  event.preventDefault();
  const fromIndex = state.segments.findIndex((item) => item.id === draggedId);
  const toIndex = state.segments.findIndex((item) => item.id === card.dataset.id);
  if (fromIndex < 0 || toIndex < 0) return;
  const [item] = state.segments.splice(fromIndex, 1);
  state.segments.splice(toIndex, 0, item);
  renderAll();
});

els.replaceForm.addEventListener("submit", confirmReplace);
els.replaceCancel.addEventListener("click", closeReplaceModal);
els.replaceModal.addEventListener("click", (event) => {
  if (event.target === els.replaceModal) closeReplaceModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.replaceModal.hidden) closeReplaceModal();
});

renderAll();
