const SAVE_FILES_KEY = "gif-ranker-files";
const SAVE_STATE_KEY = "gif-ranker-state";
const MAX_HISTORY = 250;
const IMAGE_EXTENSIONS = new Set(["avif", "bmp", "gif", "heic", "heif", "ico", "jpeg", "jpg", "png", "svg", "tif", "tiff", "webp"]);

const elements = {
  gifInput: document.getElementById("gif-input"),
  selectionPreview: document.getElementById("selection-preview"),
  selectionCount: document.getElementById("selection-count"),
  selectionSummary: document.getElementById("selection-summary"),
  selectionFileList: document.getElementById("selection-file-list"),
  startRankingButton: document.getElementById("start-ranking-button"),
  resetSelectionButton: document.getElementById("reset-selection-button"),
  setCountOne: document.getElementById("set-count-1"),
  setCountTwo: document.getElementById("set-count-2"),
  setCountThree: document.getElementById("set-count-3"),
  workflowScreenCopy: document.getElementById("workflow-screen-copy"),
  setupMessage: document.getElementById("setup-message"),
  saveMessage: document.getElementById("save-message"),
  workflowLoad: document.getElementById("workflow-load"),
  workflowScreen: document.getElementById("workflow-screen"),
  workflowOrder: document.getElementById("workflow-order"),
  resumeButton: document.getElementById("resume-button"),
  clearSaveButton: document.getElementById("clear-save-button"),
  battlePanel: document.getElementById("battle-panel"),
  resultsPanel: document.getElementById("results-panel"),
  rankedCount: document.getElementById("ranked-count"),
  comparisonCount: document.getElementById("comparison-count"),
  estimatedTotal: document.getElementById("estimated-total"),
  statPrimaryLabel: document.getElementById("stat-primary-label"),
  statSecondaryLabel: document.getElementById("stat-secondary-label"),
  statTertiaryLabel: document.getElementById("stat-tertiary-label"),
  stageKicker: document.getElementById("stage-kicker"),
  battleTitle: document.getElementById("battle-title"),
  battleSubtitle: document.getElementById("battle-subtitle"),
  decisionLabel: document.getElementById("decision-label"),
  decisionHint: document.getElementById("decision-hint"),
  leftChoice: document.getElementById("left-choice"),
  rightChoice: document.getElementById("right-choice"),
  leftBadge: document.getElementById("left-badge"),
  rightBadge: document.getElementById("right-badge"),
  leftImage: document.getElementById("left-image"),
  rightImage: document.getElementById("right-image"),
  leftName: document.getElementById("left-name"),
  rightName: document.getElementById("right-name"),
  leftTapHint: document.getElementById("left-tap-hint"),
  rightTapHint: document.getElementById("right-tap-hint"),
  undoButton: document.getElementById("undo-button"),
  restartButton: document.getElementById("restart-button"),
  topListHeading: document.getElementById("top-list-heading"),
  cutListHeading: document.getElementById("cut-list-heading"),
  topListCopy: document.getElementById("top-list-copy"),
  topList: document.getElementById("top-list"),
  fullList: document.getElementById("full-list"),
  exportTopButton: document.getElementById("export-top-button"),
  downloadZipLink: document.getElementById("download-zip-link"),
  shareZipButton: document.getElementById("share-zip-button"),
  copyTopButton: document.getElementById("copy-top-button"),
  copyAllButton: document.getElementById("copy-all-button"),
  slideshow: document.getElementById("slideshow"),
  slideshowTitle: document.getElementById("slideshow-title"),
  slideshowTabs: document.getElementById("slideshow-tabs"),
  slideshowImage: document.getElementById("slideshow-image"),
  slideshowRank: document.getElementById("slideshow-rank"),
  slideshowCounter: document.getElementById("slideshow-counter"),
  slideshowName: document.getElementById("slideshow-name"),
  slideshowPrevious: document.getElementById("slideshow-previous"),
  slideshowNext: document.getElementById("slideshow-next")
};

const state = {
  items: [],
  itemById: new Map(),
  screeningItems: [],
  lossCounts: {},
  itemComparisonCounts: {},
  screeningOpponent: null,
  lastPairKey: "",
  leaders: [],
  cuts: [],
  currentIndex: 0,
  currentItem: null,
  searchLow: 0,
  searchHigh: 0,
  probeIndex: 0,
  comparisons: 0,
  history: [],
  topCount: 20,
  setSize: 20,
  setCount: 1,
  activeSlideIndex: 0,
  stage: "idle",
  persistenceAvailable: false,
  exportBlob: null,
  exportFilename: "",
  exportUrl: ""
};

let dbPromise = null;
let saveTimer = null;

function safeSetCount(value) {
  const parsed = Number.parseInt(value, 10);
  return [1, 2, 3].includes(parsed) ? parsed : 1;
}

function setRankedSetCount(count) {
  state.setCount = safeSetCount(count);
  const controls = [
    [elements.setCountOne, 1],
    [elements.setCountTwo, 2],
    [elements.setCountThree, 3]
  ];

  controls.forEach(([input, value]) => {
    const selected = value === state.setCount;
    input.checked = selected;
    input.closest(".set-option").classList.toggle("is-selected", selected);
  });
}

function configureRankedSets(totalItems) {
  setRankedSetCount(elements.setCountThree.checked ? 3 : elements.setCountTwo.checked ? 2 : 1);
  state.topCount = totalItems;
  state.setSize = Math.max(1, Math.ceil(totalItems / state.setCount));
}

function revokeAllUrls() {
  state.items.forEach((item) => URL.revokeObjectURL(item.url));
}

function setInputsLocked(isLocked) {
  elements.gifInput.disabled = isLocked;
  elements.setCountOne.disabled = isLocked;
  elements.setCountTwo.disabled = isLocked;
  elements.setCountThree.disabled = isLocked;
}

function updateSelectionUi() {
  const hasEnoughGifs = state.items.length >= 2;
  const isSetup = state.stage === "idle" || state.stage === "selecting";
  elements.startRankingButton.classList.toggle("hidden", !isSetup || !hasEnoughGifs);
  elements.resetSelectionButton.classList.toggle("hidden", !isSetup || state.items.length === 0);
  renderSelectionPreview();
}

function renderSelectionPreview() {
  const maxVisibleFiles = 16;
  const imageTypes = new Map();

  state.items.forEach((item) => {
    const extension = getFileExtension(item.name) || "image";
    imageTypes.set(extension, (imageTypes.get(extension) || 0) + 1);
  });

  elements.selectionPreview.classList.toggle("hidden", state.items.length === 0);
  elements.selectionCount.textContent = `${state.items.length} file${state.items.length === 1 ? "" : "s"} ready to rank`;
  elements.selectionSummary.textContent = Array.from(imageTypes, ([extension, count]) => `${count} ${extension.toUpperCase()}`).join(" · ");
  elements.selectionFileList.innerHTML = "";

  state.items.slice(0, maxVisibleFiles).forEach((item) => {
    const listItem = document.createElement("li");
    listItem.textContent = item.name;
    elements.selectionFileList.appendChild(listItem);
  });

  if (state.items.length > maxVisibleFiles) {
    const remaining = document.createElement("li");
    remaining.className = "selection-file-list-more";
    remaining.textContent = `+ ${state.items.length - maxVisibleFiles} more files`;
    elements.selectionFileList.appendChild(remaining);
  }
}

function resetUiForNewSession() {
  elements.battlePanel.classList.add("hidden");
  elements.resultsPanel.classList.add("hidden");
  elements.topList.innerHTML = "";
  elements.fullList.innerHTML = "";
  elements.selectionPreview.classList.add("hidden");
  elements.selectionFileList.innerHTML = "";
  elements.topListCopy.textContent = "";
  elements.slideshow.classList.add("hidden");
  elements.slideshowTabs.innerHTML = "";
  elements.downloadZipLink.classList.add("hidden");
  elements.shareZipButton.classList.add("hidden");
  renderWorkflow("load");
  updateSelectionUi();
}

function renderWorkflow(stage) {
  const steps = [
    [elements.workflowLoad, "load"],
    [elements.workflowScreen, "screen"],
    [elements.workflowOrder, "order"]
  ];
  const activeIndex = stage === "done" ? steps.length : steps.findIndex(([, name]) => name === stage);

  steps.forEach(([element], index) => {
    element.classList.toggle("is-active", index === activeIndex);
    element.classList.toggle("is-complete", index < activeIndex);
  });
}

function clearPreparedZip() {
  if (state.exportUrl) {
    URL.revokeObjectURL(state.exportUrl);
  }
  state.exportBlob = null;
  state.exportFilename = "";
  state.exportUrl = "";
  elements.downloadZipLink.removeAttribute("href");
  elements.downloadZipLink.classList.add("hidden");
  elements.shareZipButton.classList.add("hidden");
}

function clearInMemoryState() {
  revokeAllUrls();
  state.items = [];
  state.itemById = new Map();
  state.screeningItems = [];
  state.lossCounts = {};
  state.itemComparisonCounts = {};
  state.screeningOpponent = null;
  state.lastPairKey = "";
  state.leaders = [];
  state.cuts = [];
  state.currentIndex = 0;
  state.currentItem = null;
  state.searchLow = 0;
  state.searchHigh = 0;
  state.probeIndex = 0;
  state.comparisons = 0;
  state.history = [];
  state.setSize = 20;
  state.setCount = 1;
  state.activeSlideIndex = 0;
  state.stage = "idle";
  clearPreparedZip();
  setInputsLocked(false);
  updateSelectionUi();
}

function createItemsFromFiles(files) {
  state.items = [];
  appendItemsFromFiles(files);
}

function appendItemsFromFiles(files, hashes = []) {
  const firstIndex = state.items.length;
  const additions = files.map((file, index) => ({
    id: `gif-${firstIndex + index}`,
    name: file.name,
    file,
    contentHash: hashes[index] || "",
    url: URL.createObjectURL(file),
    previewUrl: "",
    previewPromise: null
  }));
  state.items.push(...additions);
  state.itemById = new Map(state.items.map((item) => [item.id, item]));
}

async function getFileContentHash(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (typeof crypto !== "undefined" && crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  // Modern iOS Safari supports SHA-256 above. This fallback still prevents nearly all accidental duplicates.
  return `crc32-${crc32(bytes).toString(16)}-${bytes.byteLength}`;
}

async function excludeDuplicateFiles(files) {
  const existingHashes = new Set();
  const existingNames = new Set();

  for (const item of state.items) {
    if (!item.contentHash) {
      item.contentHash = await getFileContentHash(item.file);
    }
    existingHashes.add(item.contentHash);
    existingNames.add(normalizeFileName(item.name));
  }

  const uniqueFiles = [];
  const uniqueHashes = [];
  let contentDuplicates = 0;
  let nameDuplicates = 0;

  for (const file of files) {
    const normalizedName = normalizeFileName(file.name);
    if (existingNames.has(normalizedName)) {
      nameDuplicates += 1;
      continue;
    }

    const hash = await getFileContentHash(file);
    if (existingHashes.has(hash)) {
      contentDuplicates += 1;
      continue;
    }

    existingHashes.add(hash);
    existingNames.add(normalizedName);
    uniqueFiles.push(file);
    uniqueHashes.push(hash);
  }

  return { uniqueFiles, uniqueHashes, contentDuplicates, nameDuplicates };
}

function getPreviewDataUrl(item) {
  if (item.previewUrl) {
    return Promise.resolve(item.previewUrl);
  }

  if (item.previewPromise) {
    return item.previewPromise;
  }

  item.previewPromise = item.file
    .arrayBuffer()
    .then((buffer) => {
      const bytes = new Uint8Array(buffer);
      const chunkSize = 0x8000;
      let binary = "";

      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
      }

      const mediaType = getImageMimeType(item.file);
      item.previewUrl = `data:${mediaType};base64,${btoa(binary)}`;
      item.previewPromise = null;
      return item.previewUrl;
    })
    .catch((error) => {
      item.previewPromise = null;
      throw error;
    });

  return item.previewPromise;
}

function getRankedOpponent() {
  return state.stage === "screening" ? state.screeningOpponent : state.leaders[state.probeIndex];
}

function snapshotState() {
  return {
    screeningItems: [...state.screeningItems],
    lossCounts: { ...state.lossCounts },
    itemComparisonCounts: { ...state.itemComparisonCounts },
    screeningOpponent: state.screeningOpponent,
    lastPairKey: state.lastPairKey,
    leaders: [...state.leaders],
    cuts: [...state.cuts],
    currentIndex: state.currentIndex,
    currentItem: state.currentItem,
    searchLow: state.searchLow,
    searchHigh: state.searchHigh,
    probeIndex: state.probeIndex,
    comparisons: state.comparisons,
    stage: state.stage
  };
}

function pushHistory() {
  state.history.push(snapshotState());
  if (state.history.length > MAX_HISTORY) {
    state.history.shift();
  }
}

function restoreFromHistory() {
  const previous = state.history.pop();
  if (!previous) {
    return;
  }

  state.leaders = [...previous.leaders];
  state.cuts = [...previous.cuts];
  state.screeningItems = [...previous.screeningItems];
  state.lossCounts = { ...previous.lossCounts };
  state.itemComparisonCounts = { ...previous.itemComparisonCounts };
  state.screeningOpponent = previous.screeningOpponent;
  state.lastPairKey = previous.lastPairKey;
  state.currentIndex = previous.currentIndex;
  state.currentItem = previous.currentItem;
  state.searchLow = previous.searchLow;
  state.searchHigh = previous.searchHigh;
  state.probeIndex = previous.probeIndex;
  state.comparisons = previous.comparisons;
  state.stage = previous.stage;
}

function serializeState() {
  return {
    version: 5,
    topCount: state.topCount,
    setSize: state.setSize,
    setCount: state.setCount,
    screeningItemIds: state.screeningItems.map((item) => item.id),
    lossCounts: state.lossCounts,
    itemComparisonCounts: state.itemComparisonCounts,
    screeningOpponentId: state.screeningOpponent ? state.screeningOpponent.id : null,
    lastPairKey: state.lastPairKey,
    currentIndex: state.currentIndex,
    currentItemId: state.currentItem ? state.currentItem.id : null,
    searchLow: state.searchLow,
    searchHigh: state.searchHigh,
    probeIndex: state.probeIndex,
    comparisons: state.comparisons,
    stage: state.stage,
    leaderIds: state.leaders.map((item) => item.id),
    cutIds: state.cuts.map((item) => item.id),
    history: state.history.map((entry) => ({
      screeningItemIds: entry.screeningItems.map((item) => item.id),
      lossCounts: entry.lossCounts,
      itemComparisonCounts: entry.itemComparisonCounts,
      screeningOpponentId: entry.screeningOpponent ? entry.screeningOpponent.id : null,
      lastPairKey: entry.lastPairKey,
      leaderIds: entry.leaders.map((item) => item.id),
      cutIds: entry.cuts.map((item) => item.id),
      currentIndex: entry.currentIndex,
      currentItemId: entry.currentItem ? entry.currentItem.id : null,
      searchLow: entry.searchLow,
      searchHigh: entry.searchHigh,
      probeIndex: entry.probeIndex,
      comparisons: entry.comparisons,
      stage: entry.stage
    }))
  };
}

function deserializeState(snapshot) {
  const getItem = (id) => state.itemById.get(id) || null;

  if (snapshot.version !== 5) {
    throw new Error("This saved session uses an older ranking format");
  }

  state.setCount = safeSetCount(snapshot.setCount);
  state.topCount = state.items.length;
  state.setSize = Math.max(1, Math.ceil(state.items.length / state.setCount));
  state.currentIndex = snapshot.currentIndex;
  state.currentItem = getItem(snapshot.currentItemId);
  state.searchLow = snapshot.searchLow;
  state.searchHigh = snapshot.searchHigh;
  state.probeIndex = snapshot.probeIndex;
  state.comparisons = snapshot.comparisons;
  state.stage = snapshot.stage;
  state.screeningItems = snapshot.screeningItemIds.map(getItem).filter(Boolean);
  state.lossCounts = snapshot.lossCounts || {};
  state.itemComparisonCounts = snapshot.itemComparisonCounts || {};
  state.screeningOpponent = getItem(snapshot.screeningOpponentId);
  state.lastPairKey = snapshot.lastPairKey || "";
  state.leaders = snapshot.leaderIds.map(getItem).filter(Boolean);
  state.cuts = snapshot.cutIds.map(getItem).filter(Boolean);
  state.history = (snapshot.history || []).map((entry) => ({
    screeningItems: entry.screeningItemIds.map(getItem).filter(Boolean),
    lossCounts: entry.lossCounts || {},
    itemComparisonCounts: entry.itemComparisonCounts || {},
    screeningOpponent: getItem(entry.screeningOpponentId),
    lastPairKey: entry.lastPairKey || "",
    leaders: entry.leaderIds.map(getItem).filter(Boolean),
    cuts: entry.cutIds.map(getItem).filter(Boolean),
    currentIndex: entry.currentIndex,
    currentItem: getItem(entry.currentItemId),
    searchLow: entry.searchLow,
    searchHigh: entry.searchHigh,
    probeIndex: entry.probeIndex,
    comparisons: entry.comparisons,
    stage: entry.stage
  }));
}

function setGifImage(img, item) {
  if (img.dataset.currentItemId === item.id) {
    return;
  }

  img.dataset.currentItemId = item.id;
  img.dataset.currentUrl = item.previewUrl || item.url;
  img.onerror = () => {
    getPreviewDataUrl(item)
      .then((dataUrl) => {
        if (img.dataset.currentItemId === item.id && dataUrl) {
          img.onerror = null;
          img.dataset.currentUrl = dataUrl;
          img.src = dataUrl;
        }
      })
      .catch(() => {
        if (img.dataset.currentItemId === item.id) {
          img.alt = `${item.name} could not be previewed`;
        }
      });
  };
  img.removeAttribute("src");
  img.src = item.previewUrl || item.url;
  img.alt = item.name;
}

function createTextRankingItem(item, index, tagText) {
  const li = document.createElement("li");
  li.className = "ranking-item ranking-item-simple";

  const number = document.createElement("span");
  number.className = "ranking-number";
  number.textContent = String(index + 1);

  const copy = document.createElement("div");
  copy.className = "ranking-copy";

  const name = document.createElement("span");
  name.className = "ranking-name";
  name.textContent = item.name;

  const tag = document.createElement("span");
  tag.className = "ranking-tag";
  tag.textContent = tagText;

  copy.append(name, tag);
  li.append(number, copy);

  return li;
}

function renderBattle() {
  const rankedItem = getRankedOpponent();

  if (!rankedItem || !state.currentItem) {
    return;
  }

  const isScreening = state.stage === "screening";
  elements.statPrimaryLabel.textContent = isScreening ? "Still in" : "Ordered";
  elements.statSecondaryLabel.textContent = "Comparisons";
  elements.statTertiaryLabel.textContent = isScreening ? "Removed" : "Left to order";
  elements.rankedCount.textContent = isScreening
    ? `${state.screeningItems.length} / ${state.items.length}`
    : `${state.leaders.length} / ${state.topCount}`;
  elements.comparisonCount.textContent = String(state.comparisons);
  elements.estimatedTotal.textContent = isScreening
    ? String(state.cuts.length)
    : String(Math.max(state.topCount - state.currentIndex, 0));

  if (isScreening) {
    const leftLosses = state.lossCounts[state.currentItem.id] || 0;
    const rightLosses = state.lossCounts[rankedItem.id] || 0;
    elements.stageKicker.textContent = "Stage 1 of 2 · Detailed screening";
    elements.battleTitle.textContent = "Narrow down to your final group";
    elements.battleSubtitle.textContent = "Every remaining GIF will continue into the final full ordering.";
    elements.decisionLabel.textContent = "Which GIF do you prefer?";
    elements.decisionHint.textContent = `The losing GIF gets one loss. ${state.currentItem.name}: ${leftLosses} · ${rankedItem.name}: ${rightLosses}.`;
    elements.leftBadge.textContent = leftLosses > 0 ? `${leftLosses} loss${leftLosses === 1 ? "" : "es"} · still in` : "No losses yet";
    elements.rightBadge.textContent = rightLosses > 0 ? `${rightLosses} loss${rightLosses === 1 ? "" : "es"} · still in` : "No losses yet";
    elements.leftTapHint.textContent = "Tap if you prefer this GIF";
    elements.rightTapHint.textContent = "Tap if you prefer this GIF";
  } else {
    elements.stageKicker.textContent = "Stage 2 of 2 · Final ordering";
    elements.battleTitle.textContent = `Put your final ${state.topCount} in order`;
    elements.battleSubtitle.textContent = "Every remaining GIF is being placed into your final posting order.";
    elements.decisionLabel.textContent = "Which GIF should rank higher?";
    elements.decisionHint.textContent = `Placing ${state.currentItem.name} in the final order.`;
    elements.leftBadge.textContent = "To place";
    elements.rightBadge.textContent = "Final order";
    elements.leftTapHint.textContent = "Tap to place this one higher";
    elements.rightTapHint.textContent = "Tap to keep this one higher";
  }

  setGifImage(elements.leftImage, state.currentItem);
  setGifImage(elements.rightImage, rankedItem);
  elements.leftName.textContent = state.currentItem.name;
  elements.rightName.textContent = rankedItem.name;
  elements.undoButton.disabled = state.history.length === 0;
}

function renderResults() {
  renderWorkflow("done");
  elements.battlePanel.classList.add("hidden");
  elements.resultsPanel.classList.remove("hidden");

  elements.statPrimaryLabel.textContent = "Shortlist";
  elements.statSecondaryLabel.textContent = "Compared";
  elements.statTertiaryLabel.textContent = "Trimmed";
  elements.rankedCount.textContent = `${state.leaders.length} / ${state.topCount}`;
  elements.comparisonCount.textContent = String(state.comparisons);
  elements.estimatedTotal.textContent = String(state.cuts.length);

  elements.topListHeading.textContent = `Complete ranking · ${state.topCount} GIFs`;
  elements.cutListHeading.textContent = state.cuts.length > 0 ? "Trimmed away" : "No trimmed GIFs";
  elements.topListCopy.textContent = `${state.leaders.length} GIFs are ready for your post, in your final order.`;

  elements.topList.innerHTML = "";
  state.leaders.forEach((item, index) => {
    elements.topList.appendChild(createTextRankingItem(item, index, "Keep"));
  });

  state.activeSlideIndex = 0;
  renderSlideshow();

  elements.fullList.innerHTML = "";
  state.cuts.forEach((item, index) => {
    elements.fullList.appendChild(createTextRankingItem(item, index, "Cut"));
  });
}

function getSlideSetRange(setIndex) {
  const start = setIndex * state.setSize;
  return {
    start,
    end: Math.min(start + state.setSize, state.leaders.length)
  };
}

function renderSlideshowTabs() {
  elements.slideshowTabs.innerHTML = "";
  const setTotal = Math.ceil(state.leaders.length / state.setSize);

  for (let setIndex = 0; setIndex < setTotal; setIndex += 1) {
    const { start, end } = getSlideSetRange(setIndex);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "slideshow-tab";
    button.textContent = `Set ${setIndex + 1} · #${start + 1}–#${end}`;
    button.setAttribute("aria-pressed", String(Math.floor(state.activeSlideIndex / state.setSize) === setIndex));
    button.addEventListener("click", () => {
      state.activeSlideIndex = start;
      renderSlideshow();
    });
    elements.slideshowTabs.appendChild(button);
  }
}

function renderSlideshow() {
  if (state.leaders.length === 0) {
    elements.slideshow.classList.add("hidden");
    return;
  }

  state.activeSlideIndex = Math.max(0, Math.min(state.activeSlideIndex, state.leaders.length - 1));
  const item = state.leaders[state.activeSlideIndex];
  const setIndex = Math.floor(state.activeSlideIndex / state.setSize);
  const { start, end } = getSlideSetRange(setIndex);
  const positionInSet = state.activeSlideIndex - start + 1;

  elements.slideshow.classList.remove("hidden");
  elements.slideshowTitle.textContent = `Set ${setIndex + 1} · ranks #${start + 1}–#${end}`;
  elements.slideshowRank.textContent = `#${state.activeSlideIndex + 1}`;
  elements.slideshowCounter.textContent = `${positionInSet} of ${end - start}`;
  elements.slideshowName.textContent = item.name;
  elements.slideshowPrevious.disabled = state.activeSlideIndex === start;
  elements.slideshowNext.disabled = state.activeSlideIndex === end - 1;
  setGifImage(elements.slideshowImage, item);
  renderSlideshowTabs();
}

function moveSlideshow(direction) {
  const setIndex = Math.floor(state.activeSlideIndex / state.setSize);
  const { start, end } = getSlideSetRange(setIndex);
  const next = state.activeSlideIndex + direction;

  if (next >= start && next < end) {
    state.activeSlideIndex = next;
    renderSlideshow();
  }
}

function pairKey(first, second) {
  return [first.id, second.id].sort().join("|");
}

function chooseScreeningPair() {
  const byNeedForComparison = (first, second) => {
    const firstCount = state.itemComparisonCounts[first.id] || 0;
    const secondCount = state.itemComparisonCounts[second.id] || 0;
    if (firstCount !== secondCount) return firstCount - secondCount;
    const firstLosses = state.lossCounts[first.id] || 0;
    const secondLosses = state.lossCounts[second.id] || 0;
    if (firstLosses !== secondLosses) return firstLosses - secondLosses;
    return state.items.indexOf(first) - state.items.indexOf(second);
  };

  const candidates = [...state.screeningItems].sort(byNeedForComparison);
  state.currentItem = candidates[0];
  const alternatives = candidates.slice(1).sort((first, second) => {
    const firstIsRepeat = pairKey(state.currentItem, first) === state.lastPairKey ? 1 : 0;
    const secondIsRepeat = pairKey(state.currentItem, second) === state.lastPairKey ? 1 : 0;
    return firstIsRepeat - secondIsRepeat || byNeedForComparison(first, second);
  });
  state.screeningOpponent = alternatives[0];
}

function beginFinalOrdering() {
  renderWorkflow("order");
  state.stage = "ordering";
  state.leaders = [state.screeningItems[0]];
  state.currentIndex = 1;
  state.currentItem = null;
  state.screeningOpponent = null;
  prepareOrderingStep();
}

function prepareOrderingStep() {
  if (state.currentIndex >= state.screeningItems.length) {
    state.stage = "done";
    renderResults();
    queueStateSave();
    return;
  }

  state.currentItem = state.screeningItems[state.currentIndex];
  state.searchLow = 0;
  state.searchHigh = state.leaders.length;
  state.probeIndex = Math.floor((state.searchLow + state.searchHigh) / 2);

  elements.resultsPanel.classList.add("hidden");
  elements.battlePanel.classList.remove("hidden");
  renderBattle();
  queueStateSave();
}

function finishCurrentInsertion() {
  state.leaders.splice(state.searchLow, 0, state.currentItem);

  state.currentIndex += 1;
  state.currentItem = null;
  prepareOrderingStep();
}

function startRanking() {
  clearPreparedZip();
  configureRankedSets(state.items.length);
  state.screeningItems = [...state.items];
  state.lossCounts = Object.fromEntries(state.items.map((item) => [item.id, 0]));
  state.itemComparisonCounts = Object.fromEntries(state.items.map((item) => [item.id, 0]));
  state.screeningOpponent = null;
  state.lastPairKey = "";
  state.leaders = [];
  state.cuts = [];
  state.currentIndex = 0;
  state.currentItem = null;
  state.searchLow = 0;
  state.searchHigh = 0;
  state.probeIndex = 0;
  state.comparisons = 0;
  state.history = [];
  state.stage = "screening";
  renderWorkflow("screen");

  if (state.screeningItems.length <= state.topCount) {
    beginFinalOrdering();
    return;
  }

  chooseScreeningPair();
  elements.resultsPanel.classList.add("hidden");
  elements.battlePanel.classList.remove("hidden");
  renderBattle();
  queueStateSave();
}

function handleDecision(preferCurrentItem) {
  if (!state.currentItem) {
    return;
  }

  pushHistory();
  state.comparisons += 1;

  if (state.stage === "screening") {
    const loser = preferCurrentItem ? state.screeningOpponent : state.currentItem;
    state.itemComparisonCounts[state.currentItem.id] = (state.itemComparisonCounts[state.currentItem.id] || 0) + 1;
    state.itemComparisonCounts[state.screeningOpponent.id] = (state.itemComparisonCounts[state.screeningOpponent.id] || 0) + 1;
    state.lossCounts[loser.id] = (state.lossCounts[loser.id] || 0) + 1;
    state.lastPairKey = pairKey(state.currentItem, state.screeningOpponent);

    if (state.lossCounts[loser.id] >= 4) {
      state.screeningItems = state.screeningItems.filter((item) => item.id !== loser.id);
      state.cuts.push(loser);
    }

    if (state.screeningItems.length <= state.topCount) {
      beginFinalOrdering();
      return;
    }

    chooseScreeningPair();
    renderBattle();
    queueStateSave();
    return;
  }

  if (preferCurrentItem) {
    state.searchHigh = state.probeIndex;
  } else {
    state.searchLow = state.probeIndex + 1;
  }

  if (state.searchLow >= state.searchHigh) {
    finishCurrentInsertion();
    return;
  }

  state.probeIndex = Math.floor((state.searchLow + state.searchHigh) / 2);
  renderBattle();
  queueStateSave();
}

function undoLastDecision() {
  if (state.history.length === 0) {
    return;
  }

  restoreFromHistory();
  if (state.stage === "done") {
    renderResults();
  } else {
    elements.resultsPanel.classList.add("hidden");
    elements.battlePanel.classList.remove("hidden");
    renderBattle();
  }
  queueStateSave();
}

function buildListText(items) {
  return items.map((item, index) => `${index + 1}. ${item.name}`).join("\n");
}

function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/\s+/g, " ").trim();
}

function getFileExtension(name) {
  const match = /\.([^.]+)$/.exec(name.trim());
  return match ? match[1].toLowerCase() : "";
}

function normalizeFileName(name) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function getImageMimeType(file) {
  if (file.type && file.type.startsWith("image/")) {
    return file.type;
  }

  const extension = getFileExtension(file.name || "");
  const mimeTypes = {
    avif: "image/avif", bmp: "image/bmp", gif: "image/gif", heic: "image/heic", heif: "image/heif",
    ico: "image/x-icon", jpeg: "image/jpeg", jpg: "image/jpeg", png: "image/png", svg: "image/svg+xml",
    tif: "image/tiff", tiff: "image/tiff", webp: "image/webp"
  };
  return mimeTypes[extension] || "application/octet-stream";
}

function ensureImageExtension(item) {
  const safeName = sanitizeFilename(item.name);
  if (getFileExtension(safeName)) {
    return safeName;
  }

  const extension = getImageMimeType(item.file).split("/").pop().replace("svg+xml", "svg").replace("jpeg", "jpg");
  return `${safeName}.${extension || "img"}`;
}

function padRank(index, total) {
  const width = Math.max(2, String(total).length);
  return String(index + 1).padStart(width, "0");
}

function createOrderedExportName(item, index, total) {
  const safeName = ensureImageExtension(item);
  return `${padRank(index, total)}-${safeName}`;
}

async function copyLines(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
    elements.topListCopy.textContent = successMessage;
  } catch (error) {
    elements.topListCopy.textContent = "Clipboard access failed on this browser. You can still copy the list manually.";
  }
}

function updateSavedSessionButtons(hasSavedSession) {
  elements.resumeButton.classList.toggle("hidden", !hasSavedSession);
  elements.clearSaveButton.classList.toggle("hidden", !hasSavedSession);
}

function getDb() {
  if (!("indexedDB" in window)) {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open("gif-ranker-db", 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("session");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return dbPromise;
}

async function dbGet(key) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction("session", "readonly").objectStore("session").get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbPut(key, value) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("session", "readwrite");
    transaction.objectStore("session").put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function dbDelete(key) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("session", "readwrite");
    transaction.objectStore("session").delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function persistFiles() {
  try {
    await dbPut(
      SAVE_FILES_KEY,
      state.items.map((item) => ({ id: item.id, name: item.name, file: item.file, contentHash: item.contentHash }))
    );
    state.persistenceAvailable = true;
    elements.saveMessage.textContent = "Auto-save is on. You can refresh later and resume on this device.";
    updateSavedSessionButtons(true);
  } catch (error) {
    state.persistenceAvailable = false;
    elements.saveMessage.textContent = "This browser could not save the GIF files for resume, but ranking still works.";
    updateSavedSessionButtons(false);
  }
}

function queueStateSave() {
  if (!state.persistenceAvailable || state.items.length === 0) {
    return;
  }

  if (saveTimer) {
    window.clearTimeout(saveTimer);
  }

  saveTimer = window.setTimeout(async () => {
    try {
      await dbPut(SAVE_STATE_KEY, serializeState());
      updateSavedSessionButtons(true);
    } catch (error) {
      elements.saveMessage.textContent = "Saving progress stopped working in this browser, but your current session can still continue.";
    }
  }, 120);
}

async function clearSavedSession() {
  try {
    await Promise.all([dbDelete(SAVE_FILES_KEY), dbDelete(SAVE_STATE_KEY)]);
  } catch (error) {
    // Ignore failures and still reset the UI.
  }

  updateSavedSessionButtons(false);
  elements.saveMessage.textContent = "";
}

function createCrc32Table() {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let current = index;
    for (let bit = 0; bit < 8; bit += 1) {
      current = (current & 1) === 1 ? (0xedb88320 ^ (current >>> 1)) : (current >>> 1);
    }
    table[index] = current >>> 0;
  }

  return table;
}

const crc32Table = createCrc32Table();

function crc32(data) {
  let crc = 0xffffffff;

  for (let index = 0; index < data.length; index += 1) {
    crc = crc32Table[(crc ^ data[index]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function dateToDosParts(date) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2);
  const dosDate =
    ((year - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate();

  return { dosTime, dosDate };
}

function writeUint16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function writeUint32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

async function buildZipBlob(items) {
  const encoder = new TextEncoder();
  const now = new Date();
  const { dosTime, dosDate } = dateToDosParts(now);
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const exportName = createOrderedExportName(item, index, items.length);
    const nameBytes = encoder.encode(exportName);
    const fileBytes = new Uint8Array(await item.file.arrayBuffer());
    const checksum = crc32(fileBytes);

    const localHeader = new ArrayBuffer(30 + nameBytes.length);
    const localView = new DataView(localHeader);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0x0800);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, dosTime);
    writeUint16(localView, 12, dosDate);
    writeUint32(localView, 14, checksum);
    writeUint32(localView, 18, fileBytes.length);
    writeUint32(localView, 22, fileBytes.length);
    writeUint16(localView, 26, nameBytes.length);
    writeUint16(localView, 28, 0);
    new Uint8Array(localHeader, 30).set(nameBytes);

    localParts.push(localHeader, fileBytes);

    const centralHeader = new ArrayBuffer(46 + nameBytes.length);
    const centralView = new DataView(centralHeader);
    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0x0800);
    writeUint16(centralView, 10, 0);
    writeUint16(centralView, 12, dosTime);
    writeUint16(centralView, 14, dosDate);
    writeUint32(centralView, 16, checksum);
    writeUint32(centralView, 20, fileBytes.length);
    writeUint32(centralView, 24, fileBytes.length);
    writeUint16(centralView, 28, nameBytes.length);
    writeUint16(centralView, 30, 0);
    writeUint16(centralView, 32, 0);
    writeUint16(centralView, 34, 0);
    writeUint16(centralView, 36, 0);
    writeUint32(centralView, 38, 0);
    writeUint32(centralView, 42, localOffset);
    new Uint8Array(centralHeader, 46).set(nameBytes);

    centralParts.push(centralHeader);
    localOffset += localHeader.byteLength + fileBytes.byteLength;
  }

  const centralDirectorySize = centralParts.reduce((sum, part) => sum + part.byteLength, 0);
  const endRecord = new ArrayBuffer(22);
  const endView = new DataView(endRecord);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, items.length);
  writeUint16(endView, 10, items.length);
  writeUint32(endView, 12, centralDirectorySize);
  writeUint32(endView, 16, localOffset);
  writeUint16(endView, 20, 0);

  return new Blob([...localParts, ...centralParts, endRecord], { type: "application/zip" });
}

async function exportTopGifs() {
  if (state.leaders.length === 0) {
    return;
  }

  const button = elements.exportTopButton;
  const previousLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Preparing ZIP...";

  try {
    const blob = await buildZipBlob(state.leaders);
    const datePart = new Date().toISOString().slice(0, 10);
    clearPreparedZip();
    state.exportBlob = blob;
    state.exportFilename = `gif-top-${state.leaders.length}-${datePart}.zip`;
    state.exportUrl = URL.createObjectURL(blob);
    elements.downloadZipLink.href = state.exportUrl;
    elements.downloadZipLink.download = state.exportFilename;
    elements.downloadZipLink.classList.remove("hidden");

    if ("File" in window && navigator.share) {
      try {
        const zipFile = new File([blob], state.exportFilename, { type: "application/zip" });
        if (!navigator.canShare || navigator.canShare({ files: [zipFile] })) {
          elements.shareZipButton.classList.remove("hidden");
        }
      } catch (error) {
        // Download remains available even when this browser cannot share files.
      }
    }

    button.textContent = "Rebuild ZIP";
    elements.topListCopy.textContent = "Your ZIP is ready. Use Download ZIP, or Share ZIP on supported devices.";
  } catch (error) {
    elements.topListCopy.textContent = "Could not prepare the ZIP. Your top list text export still works.";
  } finally {
    button.disabled = false;
    if (!state.exportBlob) {
      button.textContent = previousLabel;
    }
  }
}

async function sharePreparedZip() {
  if (!state.exportBlob || !state.exportFilename || !navigator.share || !("File" in window)) {
    return;
  }

  try {
    const zipFile = new File([state.exportBlob], state.exportFilename, { type: "application/zip" });
    await navigator.share({ title: state.exportFilename, files: [zipFile] });
    elements.topListCopy.textContent = "Shared your ordered GIF ZIP with numbered filenames.";
  } catch (error) {
    if (error && error.name !== "AbortError") {
      elements.topListCopy.textContent = "Sharing was unavailable. Use Download ZIP instead.";
    }
  }
}

function getImageFiles(fileList) {
  // The native picker is already limited to images by accept="image/*". Do not discard a selected
  // file based on a browser-reported MIME type; iOS and Windows sometimes leave it blank or mislabel it.
  return Array.from(fileList);
}

async function addFilesToSelection(fileList) {
  const files = getImageFiles(fileList);

  if (files.length === 0) {
    elements.setupMessage.textContent = "That batch did not contain any supported image files. Try choosing GIFs or images from Files.";
    return;
  }

  if (state.stage !== "idle" && state.stage !== "selecting") {
    elements.setupMessage.textContent = "Restart or finish the current ranking before adding another batch.";
    return;
  }

  const { uniqueFiles, uniqueHashes, contentDuplicates, nameDuplicates } = await excludeDuplicateFiles(files);
  const duplicates = contentDuplicates + nameDuplicates;

  if (uniqueFiles.length === 0) {
    elements.setupMessage.textContent = duplicates === 1
      ? "That batch was already selected, so its duplicate image was skipped."
      : `All ${duplicates} images in that batch were skipped because they matched an existing file or filename.`;
    return;
  }

  appendItemsFromFiles(uniqueFiles, uniqueHashes);
  state.stage = "selecting";
  updateSelectionUi();
  const duplicateCopy = duplicates > 0 ? ` ${duplicates} duplicate${duplicates === 1 ? " was" : "s were"} skipped (${nameDuplicates} matching name${nameDuplicates === 1 ? "" : "s"}, ${contentDuplicates} matching file${contentDuplicates === 1 ? "" : "s"}).` : "";
  elements.setupMessage.textContent = `${state.items.length} image${state.items.length === 1 ? "" : "s"} added across your batches.${duplicateCopy} Check the ready-to-rank list, then add another batch or start the full ranking.`;
  elements.saveMessage.textContent = "Saving this batch so it stays selected if iOS returns from the picker.";

  await persistFiles();
  if (state.persistenceAvailable) {
    try {
      await dbPut(SAVE_STATE_KEY, serializeState());
      elements.saveMessage.textContent = `${state.items.length} image${state.items.length === 1 ? "" : "s"} saved. You can safely add another batch.`;
    } catch (error) {
      elements.saveMessage.textContent = "This batch is selected, but this browser could not save it for a reload.";
    }
  }
}

async function startSelectedRanking() {
  if (state.items.length < 2) {
    elements.setupMessage.textContent = "Add at least 2 images before starting.";
    return;
  }

  configureRankedSets(state.items.length);
  setInputsLocked(true);
  elements.setupMessage.textContent = `${state.items.length} images loaded. Every image will be included in the full final ranking.`;
  elements.saveMessage.textContent = "Saving these GIFs locally so you can resume this session if needed.";
  await persistFiles();
  startRanking();
}

async function resetSelectedGifs() {
  clearInMemoryState();
  resetUiForNewSession();
  elements.gifInput.value = "";
  elements.setupMessage.textContent = "Selected GIFs cleared. Add a batch to begin again.";
  elements.saveMessage.textContent = "";
  await clearSavedSession();
}

async function loadFiles(fileList) {
  // Maintained as an alias for any existing integrations using the old loader.
  return addFilesToSelection(fileList);
}

async function legacyStartFromFiles(fileList) {
  const files = getImageFiles(fileList);

  if (files.length < 2) {
    elements.setupMessage.textContent = "Choose at least 2 GIF or image files to start ranking.";
    resetUiForNewSession();
    return;
  }

  clearInMemoryState();
  appendItemsFromFiles(files);
  await startSelectedRanking();
}

async function restoreSavedSession() {
  const filesRecord = await dbGet(SAVE_FILES_KEY);
  const snapshot = await dbGet(SAVE_STATE_KEY);

  if (!filesRecord || !snapshot) {
    elements.setupMessage.textContent = "No saved session was found anymore.";
    updateSavedSessionButtons(false);
    return;
  }

  clearInMemoryState();

  const restoredFiles = filesRecord
    .map((entry) => {
      if (!entry || !(entry.file instanceof Blob)) {
        return null;
      }
      return {
        file: new File([entry.file], entry.name, { type: getImageMimeType(entry.file) }),
        contentHash: entry.contentHash || ""
      };
    })
    .filter(Boolean);

  if (restoredFiles.length < 2) {
    elements.setupMessage.textContent = "The saved session was incomplete, so it could not be restored.";
    await clearSavedSession();
    return;
  }

  createItemsFromFiles(restoredFiles.map((entry) => entry.file));
  state.items.forEach((item, index) => {
    item.contentHash = restoredFiles[index].contentHash;
  });
  state.persistenceAvailable = true;
  deserializeState(snapshot);

  setRankedSetCount(state.setCount);
  if (state.stage === "selecting") {
    setInputsLocked(false);
    resetUiForNewSession();
    elements.setupMessage.textContent = `Restored ${state.items.length} selected GIFs. Add another batch, or start the full ranking.`;
    elements.saveMessage.textContent = "Your unfinished selection is saved on this device.";
    return;
  }

  setInputsLocked(true);
  elements.setupMessage.textContent = `Restored ${state.items.length} GIFs and your saved progress.`;
  elements.saveMessage.textContent = "Auto-save is on for this restored session too.";
  updateSavedSessionButtons(true);

  if (state.stage === "done") {
    renderResults();
  } else {
    elements.resultsPanel.classList.add("hidden");
    elements.battlePanel.classList.remove("hidden");
    renderBattle();
  }
}

async function initSavedSessionUi() {
  try {
    const [filesRecord, snapshot] = await Promise.all([dbGet(SAVE_FILES_KEY), dbGet(SAVE_STATE_KEY)]);
    const hasSavedSession = Boolean(filesRecord && snapshot);
    updateSavedSessionButtons(hasSavedSession);

    if (hasSavedSession) {
      if (snapshot.stage === "selecting") {
        await restoreSavedSession();
        return;
      }
      elements.setupMessage.textContent = "A saved session is available on this device.";
      elements.saveMessage.textContent = "You can resume where you left off or clear it and start fresh.";
    } else {
      elements.setupMessage.textContent = "Waiting for your GIFs.";
    }
  } catch (error) {
    updateSavedSessionButtons(false);
    elements.setupMessage.textContent = "Waiting for your GIFs.";
    elements.saveMessage.textContent = "This browser may not support saved sessions, but you can still rank your GIFs.";
  }
}

elements.gifInput.addEventListener("change", async (event) => {
  try {
    await loadFiles(event.target.files);
  } catch (error) {
    elements.setupMessage.textContent = "Those GIFs could not be loaded cleanly. Try selecting them again.";
  } finally {
    // Let iOS return the same file in a later batch if needed.
    event.target.value = "";
  }
});
elements.startRankingButton.addEventListener("click", () => {
  startSelectedRanking();
});
elements.resetSelectionButton.addEventListener("click", () => {
  resetSelectedGifs();
});
elements.setCountOne.addEventListener("change", () => {
  if (elements.setCountOne.checked) {
    setRankedSetCount(1);
  }
});
elements.setCountTwo.addEventListener("change", () => {
  if (elements.setCountTwo.checked) {
    setRankedSetCount(2);
  }
});
elements.setCountThree.addEventListener("change", () => {
  if (elements.setCountThree.checked) {
    setRankedSetCount(3);
  }
});
elements.leftChoice.addEventListener("click", () => handleDecision(true));
elements.rightChoice.addEventListener("click", () => handleDecision(false));
elements.undoButton.addEventListener("click", undoLastDecision);
elements.restartButton.addEventListener("click", () => {
  if (state.items.length > 1) {
    startRanking();
  }
});
elements.exportTopButton.addEventListener("click", () => {
  exportTopGifs();
});
elements.shareZipButton.addEventListener("click", () => {
  sharePreparedZip();
});
elements.slideshowPrevious.addEventListener("click", () => {
  moveSlideshow(-1);
});
elements.slideshowNext.addEventListener("click", () => {
  moveSlideshow(1);
});
elements.copyTopButton.addEventListener("click", () => {
  copyLines(buildListText(state.leaders), `Copied your top ${state.leaders.length} list to the clipboard.`);
});
elements.copyAllButton.addEventListener("click", () => {
  copyLines(buildListText(state.cuts), "Copied your cut list to the clipboard.");
});
elements.resumeButton.addEventListener("click", async () => {
  try {
    await restoreSavedSession();
  } catch (error) {
    elements.setupMessage.textContent = error && /older ranking format/.test(error.message)
      ? "This saved session uses the previous ranking method. Clear it and start a new two-stage ranking."
      : "The saved session could not be restored cleanly. Clear it and start fresh.";
  }
});
elements.clearSaveButton.addEventListener("click", async () => {
  await clearSavedSession();
  if (state.items.length === 0) {
    elements.setupMessage.textContent = "Saved session cleared. Load GIFs to start fresh.";
  }
});

window.addEventListener("beforeunload", () => {
  if (saveTimer) {
    window.clearTimeout(saveTimer);
  }
  revokeAllUrls();
});

resetUiForNewSession();
initSavedSessionUi();
