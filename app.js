const STORAGE_KEY = "acnh-critterpedia-state-v1";
const collator = new Intl.Collator("ko");
const TYPE_LABELS = {
  bugs: "곤충",
  fish: "물고기",
  sea: "해산물",
};

const elements = {
  heroNowText: document.getElementById("heroNowText"),
  heroMetaText: document.getElementById("heroMetaText"),
  summaryGrid: document.getElementById("summaryGrid"),
  resetStorageButton: document.getElementById("resetStorageButton"),
  typeTabs: Array.from(document.querySelectorAll("#typeTabs [data-type]")),
  searchInput: document.getElementById("searchInput"),
  hemisphereSelect: document.getElementById("hemisphereSelect"),
  sortSelect: document.getElementById("sortSelect"),
  ownedFilterSelect: document.getElementById("ownedFilterSelect"),
  donatedFilterSelect: document.getElementById("donatedFilterSelect"),
  currentOnlyCheckbox: document.getElementById("currentOnlyCheckbox"),
  activeFilters: document.getElementById("activeFilters"),
  listMeta: document.getElementById("listMeta"),
  critterGrid: document.getElementById("critterGrid"),
  detailBackdrop: document.getElementById("detailBackdrop"),
  detailPanel: document.getElementById("detailPanel"),
  detailContent: document.getElementById("detailContent"),
  closeDetailButton: document.getElementById("closeDetailButton"),
};

const appState = {
  generatedAt: "",
  critters: [],
  critterMap: new Map(),
  toggles: loadToggleState(),
  filters: {
    type: "bugs",
    q: "",
    hemisphere: "north",
    sort: "number",
    owned: "",
    donated: "",
    currentOnly: false,
  },
  detailId: null,
};

init().catch((error) => {
  console.error(error);
  elements.heroMetaText.textContent = `데이터를 불러오지 못했습니다: ${error.message}`;
  elements.critterGrid.innerHTML = '<div class="empty-state">생물 데이터를 불러오지 못했습니다.</div>';
});

async function init() {
  bindEvents();
  applyStoredFilterDefaults();
  updateNowText();
  const dataUrl = new URL("./data/critters.json", import.meta.url);
  const response = await fetch(dataUrl);
  if (!response.ok) {
    throw new Error(`Failed to load data: ${response.status} ${response.statusText}`);
  }
  const payload = await response.json();
  appState.generatedAt = String(payload?.generatedAt || "");
  appState.critters = Array.isArray(payload?.items) ? payload.items : [];
  appState.critterMap = new Map(appState.critters.map((item) => [String(item.id), item]));
  render();
}

function bindEvents() {
  elements.typeTabs.forEach((button) => {
    button.addEventListener("click", () => {
      appState.filters.type = String(button.dataset.type || "bugs");
      render();
    });
  });

  elements.searchInput.addEventListener("input", (event) => {
    appState.filters.q = String(event.target.value || "").trim();
    render();
  });

  elements.hemisphereSelect.addEventListener("change", (event) => {
    appState.filters.hemisphere = String(event.target.value || "north");
    render();
  });

  elements.sortSelect.addEventListener("change", (event) => {
    appState.filters.sort = String(event.target.value || "number");
    render();
  });

  elements.ownedFilterSelect.addEventListener("change", (event) => {
    appState.filters.owned = String(event.target.value || "");
    render();
  });

  elements.donatedFilterSelect.addEventListener("change", (event) => {
    appState.filters.donated = String(event.target.value || "");
    render();
  });

  elements.currentOnlyCheckbox.addEventListener("change", (event) => {
    appState.filters.currentOnly = Boolean(event.target.checked);
    render();
  });

  elements.resetStorageButton.addEventListener("click", () => {
    if (!window.confirm("저장된 생물 체크 상태를 모두 초기화할까요?")) return;
    appState.toggles = {};
    persistToggleState();
    render();
    if (appState.detailId) renderDetail(appState.detailId);
  });

  elements.critterGrid.addEventListener("click", (event) => {
    const toggleButton = event.target.closest("[data-toggle-id]");
    if (toggleButton) {
      const critterId = String(toggleButton.dataset.toggleId || "");
      const toggleKey = String(toggleButton.dataset.toggleKey || "");
      if (critterId && toggleKey) updateToggle(critterId, toggleKey);
      return;
    }

    const detailButton = event.target.closest("[data-detail-id]");
    if (detailButton) {
      openDetail(String(detailButton.dataset.detailId || ""));
    }
  });

  elements.closeDetailButton.addEventListener("click", closeDetail);
  elements.detailBackdrop.addEventListener("click", closeDetail);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && appState.detailId) closeDetail();
  });
}

function applyStoredFilterDefaults() {
  elements.hemisphereSelect.value = appState.filters.hemisphere;
  elements.sortSelect.value = appState.filters.sort;
  elements.currentOnlyCheckbox.checked = appState.filters.currentOnly;
}

function updateNowText() {
  const now = new Date();
  elements.heroNowText.textContent = new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(now);
}

function loadToggleState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch (error) {
    console.warn("Failed to parse localStorage state", error);
    return {};
  }
}

function persistToggleState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.toggles));
}

function getCritterState(critterId) {
  return {
    owned: false,
    donated: false,
    ...(appState.toggles[critterId] || {}),
  };
}

function updateToggle(critterId, toggleKey) {
  const current = getCritterState(critterId);
  const next = { ...current, [toggleKey]: !current[toggleKey] };
  if (toggleKey === "donated" && next.donated) next.owned = true;
  appState.toggles[critterId] = next;
  persistToggleState();
  render();
  if (appState.detailId === critterId) renderDetail(critterId);
}

function render() {
  updateNowText();
  syncTabButtons();
  renderHeroMeta();
  renderSummary();
  renderActiveFilters();
  renderList();
  if (appState.detailId) renderDetail(appState.detailId);
}

function syncTabButtons() {
  elements.typeTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.type === appState.filters.type);
  });
}

function renderHeroMeta() {
  const total = appState.critters.length;
  const typeTotal = appState.critters.filter((item) => item.type === appState.filters.type).length;
  const generatedText = appState.generatedAt
    ? `스냅샷 생성: ${new Intl.DateTimeFormat("ko-KR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(appState.generatedAt))}`
    : "스냅샷 생성 시각 정보 없음";
  elements.heroMetaText.textContent = `전체 ${total}종 | ${TYPE_LABELS[appState.filters.type]} ${typeTotal}종 | ${generatedText}`;
}

function renderSummary() {
  const filteredByType = appState.critters.filter((item) => item.type === appState.filters.type);
  const ownedCount = filteredByType.filter((item) => getCritterState(item.id).owned).length;
  const donatedCount = filteredByType.filter((item) => getCritterState(item.id).donated).length;
  const availableNowCount = filteredByType.filter((item) => isAvailableNow(item, appState.filters.hemisphere)).length;
  const totalSell = filteredByType.reduce((sum, item) => sum + Number(item.sellPrice || 0), 0);

  const cards = [
    { label: `${TYPE_LABELS[appState.filters.type]} 전체`, value: filteredByType.length },
    { label: "잡은 생물", value: ownedCount },
    { label: "기증한 생물", value: donatedCount },
    { label: "지금 출현", value: availableNowCount },
    { label: "도감 완성도", value: percent(ownedCount, filteredByType.length) },
    { label: "총 판매가", value: formatBell(totalSell) },
  ];

  elements.summaryGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="summary-card">
          <span class="label">${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(String(card.value))}</strong>
        </article>
      `
    )
    .join("");
}

function renderActiveFilters() {
  const chips = [TYPE_LABELS[appState.filters.type]];
  if (appState.filters.q) chips.push(`검색: ${appState.filters.q}`);
  chips.push(appState.filters.hemisphere === "south" ? "남반구" : "북반구");
  if (appState.filters.currentOnly) chips.push("지금 출현만");
  if (appState.filters.owned === "owned") chips.push("잡은 것만");
  if (appState.filters.owned === "unowned") chips.push("미획득만");
  if (appState.filters.donated === "donated") chips.push("기증한 것만");
  if (appState.filters.donated === "undonated") chips.push("미기증만");

  elements.activeFilters.innerHTML = chips
    .map((chip) => `<span class="filter-pill">${escapeHtml(chip)}</span>`)
    .join("");
}

function renderList() {
  const items = getVisibleCritters();
  const availableCount = items.filter((item) => isAvailableNow(item, appState.filters.hemisphere)).length;
  elements.listMeta.textContent = `${items.length}종 표시 중 · 지금 출현 ${availableCount}종`;

  if (!items.length) {
    elements.critterGrid.innerHTML = '<div class="empty-state">조건에 맞는 생물이 없습니다.</div>';
    return;
  }

  elements.critterGrid.innerHTML = items.map((item) => renderCard(item)).join("");
}

function getVisibleCritters() {
  const query = normalizeText(appState.filters.q);
  const items = appState.critters.filter((item) => {
    if (item.type !== appState.filters.type) return false;

    const itemState = getCritterState(item.id);
    if (appState.filters.owned === "owned" && !itemState.owned) return false;
    if (appState.filters.owned === "unowned" && itemState.owned) return false;
    if (appState.filters.donated === "donated" && !itemState.donated) return false;
    if (appState.filters.donated === "undonated" && itemState.donated) return false;
    if (appState.filters.currentOnly && !isAvailableNow(item, appState.filters.hemisphere)) return false;

    if (query) {
      const haystack = normalizeText([
        item.nameKo,
        item.nameEn,
        item.locationKo,
        item.rarity,
      ].join(" "));
      if (!haystack.includes(query)) return false;
    }

    return true;
  });

  const sorted = [...items];
  sorted.sort((left, right) => compareCritters(left, right, appState.filters.sort));
  return sorted;
}

function renderCard(item) {
  const itemState = getCritterState(item.id);
  const available = isAvailableNow(item, appState.filters.hemisphere);
  const hemisphereData = item[appState.filters.hemisphere];
  const primaryTime = getCurrentMonthTimeText(item, appState.filters.hemisphere);
  const priceLabel = item.type === "bugs"
    ? `너굴 ${formatBell(item.sellPrice)} · 레온 ${formatBell(item.sellBonusPrice)}`
    : item.type === "fish"
      ? `너굴 ${formatBell(item.sellPrice)} · 저스틴 ${formatBell(item.sellBonusPrice)}`
      : `너굴 ${formatBell(item.sellPrice)}`;

  return `
    <article class="critter-card">
      <img src="${escapeAttribute(item.iconImageUrl)}" alt="${escapeAttribute(item.nameKo)} 아이콘" loading="lazy" />
      <div class="card-copy">
        <div class="card-title-row">
          <div>
            <h3 class="card-name">${escapeHtml(item.nameKo)}</h3>
            <p class="card-en">${escapeHtml(item.nameEn)}</p>
          </div>
          ${available ? '<span class="status-chip available">지금 출현</span>' : ""}
        </div>
        <p class="card-meta"><strong>No.${item.number}</strong> · ${escapeHtml(item.locationKo || "-")}</p>
        <p class="card-submeta">${escapeHtml(item.rarity || "희귀도 정보 없음")} · ${escapeHtml(item.shadowLabel || "크기 정보 없음")}</p>
        <p class="card-submeta">${escapeHtml(hemisphereData.monthsText || "-")} · ${escapeHtml(primaryTime || hemisphereData.timeText || "-")}</p>
        <p class="card-price">${escapeHtml(priceLabel)}</p>
        <div class="card-actions">
          <button
            type="button"
            class="toggle-button owned ${itemState.owned ? "is-on" : ""}"
            data-toggle-id="${escapeAttribute(item.id)}"
            data-toggle-key="owned"
          >
            ${itemState.owned ? "잡음" : "미획득"}
          </button>
          <button
            type="button"
            class="toggle-button donated ${itemState.donated ? "is-on" : ""}"
            data-toggle-id="${escapeAttribute(item.id)}"
            data-toggle-key="donated"
          >
            ${itemState.donated ? "기증 완료" : "미기증"}
          </button>
          <button type="button" class="detail-button" data-detail-id="${escapeAttribute(item.id)}">상세 보기</button>
        </div>
      </div>
    </article>
  `;
}

function openDetail(critterId) {
  if (!appState.critterMap.has(critterId)) return;
  appState.detailId = critterId;
  elements.detailBackdrop.classList.remove("hidden");
  elements.detailPanel.classList.remove("hidden");
  elements.detailPanel.setAttribute("aria-hidden", "false");
  renderDetail(critterId);
}

function closeDetail() {
  appState.detailId = null;
  elements.detailBackdrop.classList.add("hidden");
  elements.detailPanel.classList.add("hidden");
  elements.detailPanel.setAttribute("aria-hidden", "true");
}

function renderDetail(critterId) {
  const item = appState.critterMap.get(critterId);
  if (!item) return;

  const itemState = getCritterState(critterId);
  const available = isAvailableNow(item, appState.filters.hemisphere);
  const hemisphereData = item[appState.filters.hemisphere];
  const priceLabel = item.type === "bugs"
    ? `너굴 판매가 ${formatBell(item.sellPrice)} / 레온 ${formatBell(item.sellBonusPrice)}`
    : item.type === "fish"
      ? `너굴 판매가 ${formatBell(item.sellPrice)} / 저스틴 ${formatBell(item.sellBonusPrice)}`
      : `너굴 판매가 ${formatBell(item.sellPrice)}`;
  const hemisphereLabel = appState.filters.hemisphere === "south" ? "남" : "북";

  const fields = [
    ["출현 위치", item.locationKo || "-"],
    ["희귀도", item.rarity || "-"],
    ["그림자/크기", item.shadowLabel || "-"],
    ["움직임/속도", item.movementLabel || "-"],
    ["날씨 조건", item.weatherLabel || "-"],
    [`${hemisphereLabel}반구 출현 월`, hemisphereData.monthsText || "-"],
    [`${hemisphereLabel}반구 출현 시간`, hemisphereData.timeText || "-"],
    ["현재 달 출현 시간", getCurrentMonthTimeText(item, appState.filters.hemisphere) || "이번 달 출현하지 않음"],
  ];

  elements.detailContent.innerHTML = `
    <section class="detail-header">
      <img src="${escapeAttribute(item.imageUrl)}" alt="${escapeAttribute(item.nameKo)} 이미지" />
      <div>
        <h2 class="detail-title">${escapeHtml(item.nameKo)}</h2>
        <p class="detail-subtitle">${escapeHtml(item.nameEn)} · ${escapeHtml(TYPE_LABELS[item.type])} · No.${item.number}</p>
        <div class="detail-status-row">
          <span class="detail-status">${available ? "지금 출현 중" : "현재 미출현"}</span>
          <span class="detail-status">${itemState.owned ? "잡은 생물" : "아직 못 잡음"}</span>
          <span class="detail-status">${itemState.donated ? "박물관 기증 완료" : "박물관 미기증"}</span>
        </div>
      </div>
    </section>

    <section class="detail-grid">
      <article class="detail-key-stat">
        <span>판매가</span>
        <strong>${escapeHtml(priceLabel)}</strong>
      </article>
      <article class="detail-key-stat">
        <span>대표 문구</span>
        <strong>${escapeHtml(item.catchphrase || "-")}</strong>
      </article>
    </section>

    <section class="detail-section">
      <h3>기본 정보</h3>
      <dl class="detail-field-list">
        ${fields
          .map(
            ([label, value]) => `
              <div class="detail-field">
                <dt>${escapeHtml(label)}</dt>
                <dd>${escapeHtml(value)}</dd>
              </div>
            `
          )
          .join("")}
      </dl>
    </section>

    <section class="detail-section">
      <h3>도감 메모</h3>
      <p class="detail-note">${escapeHtml(item.museumPhrase || "도감 설명 정보가 없습니다.")}</p>
    </section>

    <section class="detail-section">
      <h3>출처</h3>
      <p class="detail-note">
        정적 스냅샷 데이터 기반 ·
        <a class="detail-link" href="${escapeAttribute(item.wikiUrl)}" target="_blank" rel="noreferrer">Nookipedia 문서 열기</a>
      </p>
    </section>
  `;
}

function isAvailableNow(item, hemisphere) {
  const region = item[hemisphere];
  if (!region) return false;
  const now = new Date();
  const month = now.getMonth() + 1;
  if (!Array.isArray(region.monthsArray) || !region.monthsArray.includes(month)) return false;
  const ranges = region.timeRangesByMonth?.[month];
  return isHourInRanges(now.getHours(), Array.isArray(ranges) ? ranges : []);
}

function isHourInRanges(hour, ranges) {
  if (!ranges.length) return false;
  return ranges.some((range) => {
    if (range === "all-day") return true;
    const [startText, endText] = String(range).split("-");
    const start = Number(startText);
    const end = Number(endText);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
    if (start === end) return true;
    if (start < end) return hour >= start && hour < end;
    return hour >= start || hour < end;
  });
}

function getCurrentMonthTimeText(item, hemisphere) {
  const region = item[hemisphere];
  if (!region) return "";
  const month = new Date().getMonth() + 1;
  return String(region.timesByMonth?.[month] || "").trim();
}

function compareCritters(left, right, sortKey) {
  if (sortKey === "nameKo") {
    return collator.compare(left.nameKo, right.nameKo) || left.number - right.number;
  }
  if (sortKey === "sellPrice") {
    return Number(right.sellPrice || 0) - Number(left.sellPrice || 0) || left.number - right.number;
  }
  return left.number - right.number || collator.compare(left.nameKo, right.nameKo);
}

function formatBell(value) {
  return `${Number(value || 0).toLocaleString("ko-KR")}벨`;
}

function percent(part, total) {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, "");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}
