const storageKey = "zfl17-film-strip-desk";

const fallbackThumbs = ["#d49b35", "#347d89", "#b54d48", "#4d7656", "#6d6378"];

// 剩余场次低于等于该值时视为场次紧张，进入提醒
const LOW_REMAINING = 2;

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
      limit: 30,
      used: 0
    },
    {
      id: crypto.randomUUID(),
      code: "A-006",
      duration: 9,
      shift: "偏红",
      damage: "轻微划痕",
      note: "人物近景左侧有划痕，试映时留意是否明显。",
      thumb: "",
      limit: 20,
      used: 5
    },
    {
      id: crypto.randomUUID(),
      code: "A-012",
      duration: 14,
      shift: "褪色",
      damage: "接片松动",
      note: "接片位置靠近段尾，放映前建议重新压平。",
      thumb: "",
      limit: 8,
      used: 6
    }
  ],
  bookings: [],
  archived: []
};

let state = loadState();
let draggedId = null;
let replacingId = null;

const els = {
  reelTitle: document.querySelector("#reelTitle"),
  colorFilter: document.querySelector("#colorFilter"),
  searchInput: document.querySelector("#searchInput"),
  segmentForm: document.querySelector("#segmentForm"),
  codeInput: document.querySelector("#codeInput"),
  durationInput: document.querySelector("#durationInput"),
  shiftInput: document.querySelector("#shiftInput"),
  damageInput: document.querySelector("#damageInput"),
  limitInput: document.querySelector("#limitInput"),
  usedInput: document.querySelector("#usedInput"),
  thumbInput: document.querySelector("#thumbInput"),
  noteInput: document.querySelector("#noteInput"),
  segmentList: document.querySelector("#segmentList"),
  warningList: document.querySelector("#warningList"),
  totalDuration: document.querySelector("#totalDuration"),
  damageCount: document.querySelector("#damageCount"),
  segmentCount: document.querySelector("#segmentCount"),
  tightCount: document.querySelector("#tightCount"),
  exportBtn: document.querySelector("#exportBtn"),
  bookingForm: document.querySelector("#bookingForm"),
  bookingTitleInput: document.querySelector("#bookingTitleInput"),
  bookingDateInput: document.querySelector("#bookingDateInput"),
  bookingError: document.querySelector("#bookingError"),
  bookingList: document.querySelector("#bookingList"),
  historyList: document.querySelector("#historyList"),
  slotOverview: document.querySelector("#slotOverview"),
  archiveList: document.querySelector("#archiveList"),
  replaceDialog: document.querySelector("#replaceDialog"),
  replaceForm: document.querySelector("#replaceForm"),
  replaceSummary: document.querySelector("#replaceSummary"),
  replaceCodeInput: document.querySelector("#replaceCodeInput"),
  replaceDurationInput: document.querySelector("#replaceDurationInput"),
  replaceShiftInput: document.querySelector("#replaceShiftInput"),
  replaceDamageInput: document.querySelector("#replaceDamageInput"),
  replaceLimitInput: document.querySelector("#replaceLimitInput"),
  replaceNoteInput: document.querySelector("#replaceNoteInput")
};

function loadState() {
  const saved = localStorage.getItem(storageKey);
  let state = structuredClone(defaultState);
  if (saved) {
    try {
      state = { ...state, ...JSON.parse(saved) };
    } catch {
      state = structuredClone(defaultState);
    }
  }
  return normalizeState(state);
}

// 兼容旧数据：补齐台账字段，预订与已映分开存放
function normalizeState(state) {
  state.segments = (state.segments || []).map((item) => ({
    ...item,
    limit: Math.max(1, Number(item.limit) || 30),
    used: Math.max(0, Number(item.used) || 0)
  }));
  state.bookings = (state.bookings || []).map((item) => ({
    ...item,
    status: item.status === "done" ? "done" : "reserved",
    segmentIds: Array.isArray(item.segmentIds) ? item.segmentIds : []
  }));
  state.archived = (state.archived || []).map((item) => ({
    ...item,
    limit: Math.max(1, Number(item.limit) || 30),
    used: Math.max(0, Number(item.used) || 0)
  }));
  return state;
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

// 剩余场次 = 安全上限 - 已映 - 预订占用，预订与已映互不混算
function remainingSlots(segment) {
  return segment.limit - segment.used - reservedCount(segment.id);
}

function reservedCount(segmentId) {
  return state.bookings.filter(
    (booking) => booking.status === "reserved" && booking.segmentIds.includes(segmentId)
  ).length;
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
  const tight = state.segments.filter((item) => remainingSlots(item) <= LOW_REMAINING).length;
  els.totalDuration.textContent = formatDuration(total);
  els.damageCount.textContent = damaged;
  els.segmentCount.textContent = state.segments.length;
  els.tightCount.textContent = tight;
}

function renderList() {
  const segments = getFilteredSegments();
  els.segmentList.innerHTML =
    segments
      .map((item) => {
        const realIndex = state.segments.findIndex((segment) => segment.id === item.id);
        const hasDamage = item.damage !== "完好";
        const remaining = remainingSlots(item);
        const reserved = reservedCount(item.id);
        const status = remaining <= 0 ? "empty" : remaining <= LOW_REMAINING ? "low" : "ok";
        const percent = Math.max(0, Math.min(100, (remaining / item.limit) * 100));
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
                <span class="tag slot-${status}">剩余 ${remaining} 场</span>
              </div>
              <div class="ledger-line">
                <span>已映 ${item.used} 场 · 预订占用 ${reserved} 场 · 上限</span>
                <input type="number" min="${item.used + reserved}" value="${item.limit}" data-limit="${item.id}" title="安全上限（场）" />
                <span>场</span>
              </div>
              <div class="slot-bar"><i class="${status}" style="width:${percent}%"></i></div>
              <p class="segment-note">${escapeHtml(item.note || "没有备注。")}</p>
            </div>
            <div class="segment-actions">
              <button type="button" title="上移" data-move-up="${item.id}">↑</button>
              <button type="button" title="下移" data-move-down="${item.id}">↓</button>
              <button type="button" title="替换片段" data-replace="${item.id}">⇄</button>
              <button type="button" title="删除" data-delete="${item.id}">×</button>
            </div>
          </article>
        `;
      })
      .join("") || `<p class="empty">没有符合筛选的片段。</p>`;
}

function renderWarnings() {
  const lowRemaining = state.segments.filter((item) => remainingSlots(item) <= LOW_REMAINING);
  const conditionIssues = state.segments.filter((item) => item.damage !== "完好" || item.shift !== "正常");
  const items = [
    ...lowRemaining.map((item) => {
      const index = state.segments.findIndex((segment) => segment.id === item.id) + 1;
      const remaining = remainingSlots(item);
      return `
        <div class="warning-item">
          <strong>${index}. ${escapeHtml(item.code)}</strong>
          <span>剩余场次${remaining <= 0 ? "已用完" : `仅剩 ${remaining} 场`}（上限 ${item.limit} · 已映 ${item.used} · 预订 ${reservedCount(item.id)}），请安排替换洗印件。</span>
        </div>
      `;
    }),
    ...conditionIssues.map((item) => {
      const index = state.segments.findIndex((segment) => segment.id === item.id) + 1;
      const reasons = [item.shift !== "正常" ? item.shift : "", item.damage !== "完好" ? item.damage : ""].filter(Boolean).join(" · ");
      return `
        <div class="warning-item">
          <strong>${index}. ${escapeHtml(item.code)}</strong>
          <span>${escapeHtml(reasons)}${item.note ? `：${escapeHtml(item.note)}` : ""}</span>
        </div>
      `;
    })
  ];
  els.warningList.innerHTML = items.join("") || `<p class="empty">当前清单没有场次、颜色偏移或破损提醒。</p>`;
}

function renderBookings() {
  const reserved = state.bookings
    .filter((item) => item.status === "reserved")
    .sort((a, b) => String(a.date || "9999").localeCompare(String(b.date || "9999")));
  els.bookingList.innerHTML =
    reserved
      .map((booking) => {
        const names = booking.segmentIds
          .map((id) => state.segments.find((segment) => segment.id === id)?.code)
          .filter(Boolean);
        return `
          <div class="booking-item">
            <div class="booking-main">
              <strong>${escapeHtml(booking.title)}</strong>
              <span>${booking.date ? escapeHtml(booking.date) : "未定日期"} · 占用 ${names.length} 个片段各 1 场</span>
              <span class="booking-codes">${escapeHtml(names.join("、") || "无片段")}</span>
            </div>
            <div class="booking-actions">
              <button type="button" data-complete="${booking.id}">放映完成</button>
              <button type="button" data-cancel="${booking.id}">取消预订</button>
            </div>
          </div>
        `;
      })
      .join("") || `<p class="empty">暂无待放映预订。</p>`;

  const done = state.bookings
    .filter((item) => item.status === "done")
    .sort((a, b) => String(b.completedAt || "").localeCompare(String(a.completedAt || "")));
  els.historyList.innerHTML =
    done
      .map((booking) => {
        const names = booking.segmentIds
          .map((id) => {
            const active = state.segments.find((segment) => segment.id === id);
            if (active) return active.code;
            const archived = state.archived.find((segment) => segment.id === id);
            return archived ? `${archived.code}（已替换）` : "";
          })
          .filter(Boolean);
        return `
          <div class="booking-item done">
            <div class="booking-main">
              <strong>${escapeHtml(booking.title)}</strong>
              <span>${booking.date ? escapeHtml(booking.date) : "未定日期"} · 完成于 ${escapeHtml(booking.completedAt || "-")} · 已计入 ${names.length} 个片段</span>
              <span class="booking-codes">${escapeHtml(names.join("、") || "无片段")}</span>
            </div>
          </div>
        `;
      })
      .join("") || `<p class="empty">暂无已完成放映。</p>`;
}

function renderSlots() {
  els.slotOverview.innerHTML =
    state.segments
      .map((item) => {
        const remaining = remainingSlots(item);
        const status = remaining <= 0 ? "empty" : remaining <= LOW_REMAINING ? "low" : "ok";
        return `
          <div class="slot-item">
            <strong>${escapeHtml(item.code)}</strong>
            <span class="slot-${status}">剩余 ${remaining} 场</span>
            <span class="slot-detail">已映 ${item.used} · 预订 ${reservedCount(item.id)} · 上限 ${item.limit}</span>
          </div>
        `;
      })
      .join("") || `<p class="empty">清单为空。</p>`;
}

function renderArchive() {
  els.archiveList.innerHTML =
    state.archived
      .map((item) => {
        return `
          <div class="booking-item archived">
            <div class="booking-main">
              <strong>${escapeHtml(item.code)}</strong>
              <span>已映 ${item.used} / 上限 ${item.limit} 场 · ${escapeHtml(item.retiredAt || "-")} 被 ${escapeHtml(item.replacedBy || "新片段")} 替换</span>
            </div>
          </div>
        `;
      })
      .join("") || `<p class="empty">暂无替换留档。</p>`;
}

function renderAll() {
  saveState();
  els.reelTitle.value = state.reelTitle;
  renderStats();
  renderList();
  renderWarnings();
  renderBookings();
  renderSlots();
  renderArchive();
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
  const limit = Number(els.limitInput.value);
  const used = Number(els.usedInput.value);
  if (!Number.isFinite(limit) || limit < 1) return;
  if (!Number.isFinite(used) || used < 0 || used > limit) {
    window.alert("已放映场次不能为负，也不能超过安全上限。");
    return;
  }
  const thumb = await readFileAsDataUrl(els.thumbInput.files[0]);
  state.segments.push({
    id: crypto.randomUUID(),
    code: els.codeInput.value.trim(),
    duration: Number(els.durationInput.value),
    shift: els.shiftInput.value,
    damage: els.damageInput.value,
    note: els.noteInput.value.trim(),
    thumb,
    limit,
    used
  });
  els.segmentForm.reset();
  els.durationInput.value = 12;
  els.limitInput.value = 30;
  els.usedInput.value = 0;
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

// 预订：每个片段占用 1 场，任何片段剩余不足则整笔挡下并点名
function addBooking(event) {
  event.preventDefault();
  const title = els.bookingTitleInput.value.trim();
  if (!title) return;
  if (!state.segments.length) {
    showBookingError("清单为空，请先录入片段再预订。");
    return;
  }
  const short = state.segments.filter((item) => remainingSlots(item) < 1);
  if (short.length) {
    const detail = short
      .map((item) => `${item.code}（剩余 ${remainingSlots(item)} 场）`)
      .join("、");
    showBookingError(`剩余场次不足，无法预订：${detail}。请先替换洗印件或取消其它预订。`);
    return;
  }
  state.bookings.push({
    id: crypto.randomUUID(),
    title,
    date: els.bookingDateInput.value,
    status: "reserved",
    segmentIds: state.segments.map((item) => item.id)
  });
  els.bookingForm.reset();
  showBookingError("");
  renderAll();
}

function showBookingError(message) {
  els.bookingError.textContent = message;
  els.bookingError.hidden = !message;
}

// 取消预订：释放占用，不计入已映
function cancelBooking(id) {
  state.bookings = state.bookings.filter((item) => !(item.id === id && item.status === "reserved"));
  renderAll();
}

// 放映完成：占用转为已映，预订记录留档
function completeBooking(id) {
  const booking = state.bookings.find((item) => item.id === id && item.status === "reserved");
  if (!booking) return;
  booking.status = "done";
  booking.completedAt = new Date().toISOString().slice(0, 10);
  booking.segmentIds.forEach((segmentId) => {
    const segment = state.segments.find((item) => item.id === segmentId);
    if (segment) segment.used += 1;
  });
  renderAll();
}

function openReplaceDialog(id) {
  const segment = state.segments.find((item) => item.id === id);
  if (!segment) return;
  replacingId = id;
  const pending = state.bookings.filter(
    (booking) => booking.status === "reserved" && booking.segmentIds.includes(id)
  ).length;
  els.replaceSummary.textContent = `将替换 ${segment.code}（已映 ${segment.used} 场）。未放映的 ${pending} 笔预订会转给新片段，已映记录留在原片段留档。`;
  els.replaceCodeInput.value = "";
  els.replaceDurationInput.value = segment.duration;
  els.replaceShiftInput.value = "正常";
  els.replaceDamageInput.value = "完好";
  els.replaceLimitInput.value = segment.limit;
  els.replaceNoteInput.value = "";
  els.replaceDialog.showModal();
}

// 替换片段：新片段顶替原位置，未放映预订转给新片段，已映记录随原片段留档
function replaceSegment(event) {
  event.preventDefault();
  const index = state.segments.findIndex((item) => item.id === replacingId);
  if (index < 0) return;
  const old = state.segments[index];
  const limit = Number(els.replaceLimitInput.value);
  if (!Number.isFinite(limit) || limit < 1) return;
  const fresh = {
    id: crypto.randomUUID(),
    code: els.replaceCodeInput.value.trim(),
    duration: Number(els.replaceDurationInput.value),
    shift: els.replaceShiftInput.value,
    damage: els.replaceDamageInput.value,
    note: els.replaceNoteInput.value.trim(),
    thumb: "",
    limit,
    used: 0
  };
  state.segments.splice(index, 1, fresh);
  state.bookings.forEach((booking) => {
    if (booking.status !== "reserved") return;
    booking.segmentIds = booking.segmentIds.map((segmentId) =>
      segmentId === old.id ? fresh.id : segmentId
    );
  });
  state.archived.push({
    id: old.id,
    code: old.code,
    limit: old.limit,
    used: old.used,
    retiredAt: new Date().toISOString().slice(0, 10),
    replacedBy: fresh.code
  });
  replacingId = null;
  els.replaceDialog.close();
  renderAll();
}

function updateLimit(id, value) {
  const segment = state.segments.find((item) => item.id === id);
  if (!segment) return;
  const next = Math.floor(Number(value));
  const floor = segment.used + reservedCount(id);
  if (!Number.isFinite(next) || next < 1 || next < floor) {
    renderAll();
    return;
  }
  segment.limit = next;
  renderAll();
}

function exportList() {
  const reserved = state.bookings.filter((item) => item.status === "reserved");
  const done = state.bookings.filter((item) => item.status === "done");
  const lines = [
    `胶片卷：${state.reelTitle || "未命名胶片卷"}`,
    `总时长：${formatDuration(state.segments.reduce((sum, item) => sum + Number(item.duration), 0))}`,
    "",
    "【放映清单（按剩余场次）】",
    ...state.segments.map((item, index) => {
      const remaining = remainingSlots(item);
      return `${index + 1}. ${item.code}｜${formatDuration(item.duration)}｜${item.shift}｜${item.damage}｜剩余 ${remaining} 场（已映 ${item.used} · 预订占用 ${reservedCount(item.id)} · 上限 ${item.limit}）｜${item.note || "无备注"}`;
    }),
    "",
    "【待放映预订】",
    ...(reserved.length
      ? reserved.map((item) => `${item.title}｜${item.date || "未定日期"}｜占用 ${item.segmentIds.length} 个片段各 1 场`)
      : ["无"]),
    "",
    "【已完成放映】",
    ...(done.length
      ? done.map((item) => `${item.title}｜${item.date || "未定日期"}｜完成于 ${item.completedAt || "-"}`)
      : ["无"]),
    "",
    "【替换留档】",
    ...(state.archived.length
      ? state.archived.map((item) => `${item.code}｜已映 ${item.used} / 上限 ${item.limit} 场｜${item.retiredAt || "-"} 被 ${item.replacedBy || "新片段"} 替换`)
      : ["无"])
  ];
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
els.bookingForm.addEventListener("submit", addBooking);
els.replaceForm.addEventListener("submit", replaceSegment);
els.replaceDialog.querySelector("[data-close-replace]").addEventListener("click", () => {
  replacingId = null;
  els.replaceDialog.close();
});

els.segmentList.addEventListener("click", (event) => {
  const up = event.target.closest("[data-move-up]");
  const down = event.target.closest("[data-move-down]");
  const replace = event.target.closest("[data-replace]");
  const remove = event.target.closest("[data-delete]");
  if (up) moveSegment(up.dataset.moveUp, -1);
  if (down) moveSegment(down.dataset.moveDown, 1);
  if (replace) openReplaceDialog(replace.dataset.replace);
  if (remove) {
    const id = remove.dataset.delete;
    state.segments = state.segments.filter((item) => item.id !== id);
    // 片段已删除，待映预订不再占用它；已完成历史中的引用原样保留
    state.bookings.forEach((booking) => {
      if (booking.status !== "reserved") return;
      booking.segmentIds = booking.segmentIds.filter((segmentId) => segmentId !== id);
    });
    renderAll();
  }
});

els.segmentList.addEventListener("change", (event) => {
  const input = event.target.closest("[data-limit]");
  if (input) updateLimit(input.dataset.limit, input.value);
});

els.bookingList.addEventListener("click", (event) => {
  const complete = event.target.closest("[data-complete]");
  const cancel = event.target.closest("[data-cancel]");
  if (complete) completeBooking(complete.dataset.complete);
  if (cancel) cancelBooking(cancel.dataset.cancel);
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

renderAll();
