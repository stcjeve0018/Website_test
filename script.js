document.addEventListener('DOMContentLoaded', () => {
  const participantInput = document.getElementById('participant-file');
  const prizeInput = document.getElementById('prize-file');
  const participantSummary = document.getElementById('participant-summary');
  const prizeSummary = document.getElementById('prize-summary');
  const participantTagsDisplay = document.getElementById('participant-tags');
  const tagFilterContainer = document.getElementById('tag-filter');
  const clearFiltersButton = document.getElementById('clear-filters');
  const prizeList = document.getElementById('prize-list');
  const prizeRemainingHint = document.getElementById('prize-remaining-hint');
  const prizeDetail = document.getElementById('prize-detail');
  const drawButton = document.getElementById('draw-button');
  const resetButton = document.getElementById('reset-button');
  const messageBox = document.getElementById('lottery-message');
  const winnerName = document.getElementById('winner-name');
  const prizeName = document.getElementById('prize-name');
  const winnerTags = document.getElementById('winner-tags');
  const historyList = document.getElementById('history-list');
  const winnerCount = document.getElementById('winner-count');

  if (!participantInput || !prizeInput) {
    return;
  }

  const state = {
    participants: [],
    prizes: [],
    history: [],
    winnerIds: new Set(),
    tagDictionary: new Map(),
    selectedPrizeId: null,
  };

  participantInput.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const table = await readExcel(file);
      const participants = parseParticipants(table);
      state.participants = participants;
      resetDrawState();
      rebuildTagDictionary();
      updateParticipantSummary();
      renderTagFilters();
      showMessage(`已載入 ${participants.length} 位參與者。`, 'success');
    } catch (error) {
      clearParticipants();
      showMessage(error.message || '匯入參與者名單時發生錯誤。', 'danger');
    } finally {
      updateDrawButtonState();
    }
  });

  prizeInput.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const table = await readExcel(file);
      const prizes = parsePrizes(table);
      state.prizes = prizes;
      resetDrawState();
      rebuildTagDictionary();
      updatePrizeSummary();
      renderTagFilters();
      showMessage(`已載入 ${prizes.length} 個獎項，共 ${getTotalPrizeQuantity()} 份。`, 'success');
    } catch (error) {
      clearPrizes();
      showMessage(error.message || '匯入獎項設定時發生錯誤。', 'danger');
    } finally {
      updateDrawButtonState();
    }
  });

  prizeList.addEventListener('click', (event) => {
    const card = event.target.closest('.prize-card');
    if (!card || !(card instanceof HTMLButtonElement)) {
      return;
    }
    if (card.disabled) {
      return;
    }
    const prizeId = card.dataset.prizeId;
    if (!prizeId) {
      return;
    }
    state.selectedPrizeId = prizeId;
    updatePrizeSelectionHighlight();
    updatePrizeDetail();
    updateDrawButtonState();
  });

  clearFiltersButton.addEventListener('click', () => {
    const checkboxes = tagFilterContainer.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((checkbox) => {
      checkbox.checked = false;
    });
    updateDrawButtonState();
  });

  tagFilterContainer.addEventListener('change', (event) => {
    if (event.target instanceof HTMLInputElement && event.target.type === 'checkbox') {
      updateDrawButtonState();
    }
  });

  drawButton.addEventListener('click', handleDraw);

  resetButton.addEventListener('click', () => {
    resetDrawState(false, true);
    if (state.participants.length || state.prizes.length) {
      showMessage('已重設抽獎紀錄與中獎狀態。', 'info');
    } else {
      clearMessage();
    }
  });

  function resetDrawState(preserveMessage = false, preserveSelection = false) {
    state.winnerIds.clear();
    state.history = [];
    state.prizes.forEach((prize) => {
      prize.awarded = 0;
    });
    if (!preserveSelection) {
      state.selectedPrizeId = null;
    }
    updateWinnerDisplay();
    updateHistoryList();
    renderPrizeList();
    updatePrizeDetail();
    updatePrizeRemainingHint();
    updateWinnerCount();
    drawButton.textContent = '開始抽獎';
    updateDrawButtonState();
    if (!preserveMessage) {
      clearMessage();
    }
  }

  async function readExcel(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          if (!sheetName) {
            reject(new Error('檔案中沒有可用的工作表。'));
            return;
          }
          const sheet = workbook.Sheets[sheetName];
          const table = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
          if (!table.length) {
            reject(new Error('無法從檔案讀取到資料列。'));
            return;
          }
          const [headerRowRaw, ...dataRowsRaw] = table;
          const headerRow = Array.isArray(headerRowRaw)
            ? headerRowRaw.map((cell) => String(cell).trim())
            : [];
          const dataRows = dataRowsRaw
            .filter((row) => Array.isArray(row) && row.some((cell) => String(cell).trim() !== ''))
            .map((row) => row.map((cell) => (cell === null || cell === undefined ? '' : cell)));
          if (!headerRow.length) {
            reject(new Error('找不到標題列，請確認檔案第一列為欄位名稱。'));
            return;
          }
          resolve({ headerRow, dataRows });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('檔案讀取失敗，請再試一次。'));
      reader.readAsArrayBuffer(file);
    });
  }

  function parseParticipants(table) {
    const { headerRow, dataRows } = table;
    const headerMap = buildHeaderIndexMap(headerRow);
    let nameIndex = resolveHeaderIndex(headerMap, ['姓名', 'name', '參與者', '員工', '成員']);
    const tagIndex = resolveHeaderIndex(headerMap, ['標籤', 'tags', 'tag', '屬性', '分類']);

    if (nameIndex === null) {
      nameIndex = findFirstNonEmptyIndex(headerRow);
    }

    if (nameIndex === null) {
      throw new Error('找不到「姓名」欄位，請確認檔案第一欄或欄位名稱是否為「姓名」。');
    }

    if (tagIndex === null) {
      throw new Error('找不到「標籤」欄位，請確認欄位名稱是否為「標籤」。');
    }

    const participants = [];
    dataRows.forEach((row, index) => {
      const name = String(row[nameIndex] ?? '').trim();
      if (!name) {
        return;
      }
      const tagValues = parseTags(row[tagIndex]);
      const normalizedTags = new Set(tagValues.map(normalizeTag));
      participants.push({
        id: `participant-${index}`,
        name,
        tags: tagValues,
        normalizedTags,
      });
    });

    if (!participants.length) {
      throw new Error('未在檔案中找到有效的參與者資料。');
    }

    return participants;
  }

  function parsePrizes(table) {
    const { headerRow, dataRows } = table;
    const headerMap = buildHeaderIndexMap(headerRow);
    let nameIndex = resolveHeaderIndex(headerMap, ['獎項', 'prize', '獎品', '名稱']);
    if (nameIndex === null) {
      nameIndex = findFirstNonEmptyIndex(headerRow);
    }
    if (nameIndex === null) {
      throw new Error('找不到「獎項」欄位，請確認檔案第一欄或欄位名稱是否為「獎項」。');
    }

    const quantityIndex = resolveHeaderIndex(headerMap, ['數量', 'quantity', '份數']);
    const tagIndex = resolveHeaderIndex(headerMap, ['標籤', 'tags', 'tag', '限制', '分類']);
    const imageIndex = resolveHeaderIndex(headerMap, ['圖片', '照片', 'image', 'imageurl', 'image url', 'photo', 'picture', '圖檔', '連結']);

    const prizes = [];
    dataRows.forEach((row, index) => {
      const name = String(row[nameIndex] ?? '').trim();
      if (!name) {
        return;
      }
      const quantityRaw = quantityIndex !== null ? row[quantityIndex] : 1;
      const quantity = Number.parseInt(quantityRaw, 10);
      const total = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
      const tagValues = tagIndex !== null ? parseTags(row[tagIndex]) : [];
      const normalizedTags = new Set(tagValues.map(normalizeTag));
      const imageUrl = imageIndex !== null ? sanitizeImageUrl(row[imageIndex]) : '';

      prizes.push({
        id: `prize-${index}`,
        name,
        quantity: total,
        awarded: 0,
        tags: tagValues,
        normalizedTags,
        imageUrl,
      });
    });

    if (!prizes.length) {
      throw new Error('未在檔案中找到有效的獎項資料。');
    }

    return prizes;
  }

  function buildHeaderIndexMap(headerRow) {
    return headerRow.reduce((map, title, index) => {
      if (!title) {
        return map;
      }
      const normalized = normalizeKey(title);
      if (normalized && !map.has(normalized)) {
        map.set(normalized, index);
      }
      return map;
    }, new Map());
  }

  function resolveHeaderIndex(headerMap, candidates) {
    for (const candidate of candidates) {
      const normalized = normalizeKey(candidate);
      if (headerMap.has(normalized)) {
        return headerMap.get(normalized);
      }
    }
    return null;
  }

  function findFirstNonEmptyIndex(headerRow) {
    for (let index = 0; index < headerRow.length; index += 1) {
      if (String(headerRow[index]).trim()) {
        return index;
      }
    }
    return null;
  }

  function normalizeKey(value) {
    return String(value).trim().toLowerCase();
  }

  function parseTags(value) {
    if (value === undefined || value === null) {
      return [];
    }
    if (Array.isArray(value)) {
      return value
        .map((item) => String(item).trim())
        .filter(Boolean);
    }
    return String(value)
      .split(/[\s,;，、]+/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  function normalizeTag(tag) {
    return tag.trim().toLowerCase();
  }

  function rebuildTagDictionary() {
    state.tagDictionary.clear();
    state.participants.forEach((participant) => {
      participant.tags.forEach((tag) => {
        const normalized = normalizeTag(tag);
        if (!state.tagDictionary.has(normalized)) {
          state.tagDictionary.set(normalized, tag);
        }
      });
    });
    state.prizes.forEach((prize) => {
      prize.tags.forEach((tag) => {
        const normalized = normalizeTag(tag);
        if (!state.tagDictionary.has(normalized)) {
          state.tagDictionary.set(normalized, tag);
        }
      });
    });
    updateParticipantTags();
  }

  function updateParticipantSummary() {
    if (!state.participants.length) {
      participantSummary.innerHTML = '';
      return;
    }
    participantSummary.innerHTML = `<div class="alert alert-secondary py-2 mb-0">參與者共 ${state.participants.length} 位。</div>`;
  }

  function updatePrizeSummary() {
    if (!state.prizes.length) {
      prizeSummary.innerHTML = '';
      return;
    }
    prizeSummary.innerHTML = `<div class="alert alert-secondary py-2 mb-0">獎項共 ${state.prizes.length} 個，總計 ${getTotalPrizeQuantity()} 份。</div>`;
  }

  function updateParticipantTags() {
    if (!state.participants.length) {
      participantTagsDisplay.innerHTML = '';
      return;
    }

    const tags = new Set();
    state.participants.forEach((participant) => {
      participant.tags.forEach((tag) => tags.add(tag));
    });

    if (!tags.size) {
      participantTagsDisplay.innerHTML = '<p class="text-muted small mb-0">此名單未提供任何標籤。</p>';
      return;
    }

    const fragment = document.createDocumentFragment();
    tags.forEach((tag) => {
      const badge = document.createElement('span');
      badge.className = 'badge rounded-pill text-bg-primary-subtle text-primary-emphasis me-2 mb-2';
      badge.textContent = tag;
      fragment.appendChild(badge);
    });

    participantTagsDisplay.innerHTML = '';
    participantTagsDisplay.appendChild(fragment);
  }

  function renderPrizeList() {
    if (!prizeList) return;

    ensureSelectedPrizeAvailable();

    if (!state.prizes.length) {
      prizeList.textContent = '尚未匯入獎項';
      prizeList.classList.add('text-muted', 'small');
      updatePrizeSelectionHighlight();
      return;
    }

    prizeList.classList.remove('text-muted', 'small');
    prizeList.innerHTML = '';

    const fragment = document.createDocumentFragment();

    state.prizes.forEach((prize) => {
      const remaining = Math.max(prize.quantity - prize.awarded, 0);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'prize-card';
      card.dataset.prizeId = prize.id;
      card.disabled = remaining <= 0;
      card.setAttribute('aria-pressed', 'false');

      if (prize.imageUrl) {
        const imageWrapper = document.createElement('div');
        imageWrapper.className = 'prize-card-image';
        const image = document.createElement('img');
        image.src = prize.imageUrl;
        image.alt = prize.name;
        imageWrapper.appendChild(image);
        card.appendChild(imageWrapper);
      }

      const body = document.createElement('div');
      body.className = 'prize-card-body';

      const title = document.createElement('div');
      title.className = 'prize-card-title';
      title.textContent = prize.name;
      body.appendChild(title);

      const quantity = document.createElement('div');
      quantity.className = 'prize-card-quantity';
      quantity.textContent = `剩餘 ${remaining} / ${prize.quantity}`;
      body.appendChild(quantity);

      if (prize.tags.length) {
        const tagList = document.createElement('div');
        tagList.className = 'prize-card-tags';
        prize.tags.forEach((tag) => {
          const badge = document.createElement('span');
          badge.className = 'badge rounded-pill text-bg-primary-subtle text-primary-emphasis me-2 mb-2';
          badge.textContent = tag;
          tagList.appendChild(badge);
        });
        body.appendChild(tagList);
      }

      if (card.disabled) {
        card.classList.add('is-depleted');
      }

      card.appendChild(body);
      fragment.appendChild(card);
    });

    prizeList.appendChild(fragment);
    updatePrizeSelectionHighlight();
  }

  function ensureSelectedPrizeAvailable() {
    if (!state.selectedPrizeId) {
      return;
    }
    const prize = state.prizes.find((item) => item.id === state.selectedPrizeId);
    if (!prize || prize.quantity - prize.awarded <= 0) {
      state.selectedPrizeId = null;
    }
  }

  function updatePrizeSelectionHighlight() {
    if (!prizeList) return;
    const cards = prizeList.querySelectorAll('.prize-card');
    cards.forEach((card) => {
      const isSelected = card.dataset.prizeId === state.selectedPrizeId;
      card.classList.toggle('is-selected', isSelected);
      card.setAttribute('aria-pressed', String(isSelected));
    });
  }

  function renderTagFilters() {
    const hasTags = state.tagDictionary.size > 0;
    if (!hasTags) {
      if (state.participants.length) {
        tagFilterContainer.innerHTML = '此名單未提供可用標籤，所有參與者皆可抽獎。';
      } else {
        tagFilterContainer.innerHTML = '尚未匯入名單';
      }
      tagFilterContainer.classList.add('text-muted');
      clearFiltersButton.disabled = true;
      return;
    }

    clearFiltersButton.disabled = false;
    tagFilterContainer.classList.remove('text-muted');
    tagFilterContainer.innerHTML = '';

    const sortedTags = Array.from(state.tagDictionary.entries()).sort((a, b) => a[1].localeCompare(b[1], 'zh-Hant'));

    sortedTags.forEach(([normalized, display]) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'form-check form-check-inline me-3 mb-2';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'form-check-input';
      checkbox.id = `tag-${normalized.replace(/[^a-z0-9]+/g, '-')}`;
      checkbox.value = normalized;
      const label = document.createElement('label');
      label.className = 'form-check-label';
      label.setAttribute('for', checkbox.id);
      label.textContent = display;
      wrapper.appendChild(checkbox);
      wrapper.appendChild(label);
      tagFilterContainer.appendChild(wrapper);
    });
  }

  function updatePrizeDetail() {
    if (!prizeDetail) return;

    if (!state.prizes.length) {
      prizeDetail.textContent = '';
      return;
    }

    const prize = getSelectedPrize();
    if (!prize) {
      prizeDetail.textContent = '請點選上方獎項卡片以進行抽獎。';
      return;
    }

    const remaining = Math.max(prize.quantity - prize.awarded, 0);
    const tagsText = prize.tags.length ? prize.tags.join('、') : '不限';
    prizeDetail.textContent = `剩餘 ${remaining} / ${prize.quantity}。限定標籤：${tagsText}`;
  }

  function handleDraw() {
    const prize = getSelectedPrize();
    if (!prize) {
      showMessage('請先選擇要抽出的獎項。', 'warning');
      return;
    }

    const remaining = prize.quantity - prize.awarded;
    if (remaining <= 0) {
      showMessage('此獎項已抽完，請選擇其他獎項。', 'warning');
      renderPrizeList();
      updatePrizeDetail();
      updateDrawButtonState();
      return;
    }

    const requiredTags = new Set([...prize.normalizedTags, ...getSelectedTags()]);
    const eligibleParticipants = state.participants.filter((participant) => {
      if (state.winnerIds.has(participant.id)) {
        return false;
      }
      for (const tag of requiredTags) {
        if (tag && !participant.normalizedTags.has(tag)) {
          return false;
        }
      }
      return true;
    });

    if (!eligibleParticipants.length) {
      showMessage('沒有符合條件的參與者，請調整標籤或檢查名單。', 'danger');
      return;
    }

    setDrawButtonLoading(true);
    showMessage('抽獎進行中，請稍候...', 'info');
    const rollingInterval = startRollingEffect(eligibleParticipants, winnerName);

    setTimeout(() => {
      clearInterval(rollingInterval);
      const winner = pickRandom(eligibleParticipants);
      state.winnerIds.add(winner.id);
      prize.awarded += 1;

      updateWinnerDisplay(winner, prize, requiredTags);
      addHistoryEntry(winner, prize, requiredTags);

      showMessage(`${winner.name} 恭喜獲得「${prize.name}」！`, 'success');
      renderPrizeList();
      updatePrizeDetail();
      updateWinnerCount();
      updatePrizeRemainingHint();
      setDrawButtonLoading(false);
      updateDrawButtonState();
    }, 1600);
  }

  function getSelectedPrize() {
    if (!state.selectedPrizeId) {
      return null;
    }
    return state.prizes.find((prize) => prize.id === state.selectedPrizeId) || null;
  }

  function getSelectedTags() {
    const checkboxes = tagFilterContainer.querySelectorAll('input[type="checkbox"]');
    const selected = [];
    checkboxes.forEach((checkbox) => {
      if (checkbox.checked) {
        selected.push(checkbox.value);
      }
    });
    return selected;
  }

  function addHistoryEntry(winner, prize, requiredTags) {
    const timestamp = new Date().toLocaleString();
    const filterTags = Array.from(requiredTags).filter(Boolean).map(displayTag).join('、');
    const participantTags = winner.tags.length ? winner.tags.join('、') : '無';

    const entry = {
      winner: winner.name,
      prize: prize.name,
      filterTags,
      participantTags,
      timestamp,
    };

    state.history.unshift(entry);
    updateHistoryList();
  }

  function updateHistoryList() {
    historyList.innerHTML = '';
    if (!state.history.length) {
      const empty = document.createElement('li');
      empty.className = 'list-group-item text-center text-muted';
      empty.textContent = '尚無抽獎紀錄。';
      historyList.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    state.history.forEach((entry) => {
      const item = document.createElement('li');
      item.className = 'list-group-item d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2';

      const winnerInfo = document.createElement('div');
      const winnerName = document.createElement('strong');
      winnerName.textContent = entry.winner;
      winnerInfo.appendChild(winnerName);
      winnerInfo.appendChild(document.createTextNode(` 獲得「${entry.prize}」`));

      const meta = document.createElement('div');
      meta.className = 'text-muted small text-md-end';

      if (entry.filterTags) {
        const filterSpan = document.createElement('span');
        filterSpan.textContent = `條件標籤：${entry.filterTags}`;
        meta.appendChild(filterSpan);
        meta.appendChild(document.createElement('br'));
      }

      const tagSpan = document.createElement('span');
      tagSpan.textContent = `得獎者標籤：${entry.participantTags}`;
      meta.appendChild(tagSpan);
      meta.appendChild(document.createElement('br'));

      const timeSpan = document.createElement('span');
      timeSpan.textContent = entry.timestamp;
      meta.appendChild(timeSpan);

      item.appendChild(winnerInfo);
      item.appendChild(meta);
      fragment.appendChild(item);
    });

    historyList.appendChild(fragment);
  }

  function updateWinnerDisplay(winner, prize, requiredTags) {
    if (!winner || !prize) {
      winnerName.textContent = '尚未抽獎';
      prizeName.textContent = '';
      winnerTags.textContent = '';
      return;
    }

    winnerName.textContent = winner.name;
    prizeName.textContent = `🎁 ${prize.name}`;
    const filterTags = Array.from(requiredTags || []).filter(Boolean).map(displayTag);
    const filterText = filterTags.length ? filterTags.join('、') : '不限';
    const participantTags = winner.tags.length ? winner.tags.join('、') : '無';
    winnerTags.replaceChildren();
    const conditionLabel = document.createElement('span');
    conditionLabel.className = 'fw-semibold';
    conditionLabel.textContent = '條件標籤：';
    winnerTags.appendChild(conditionLabel);
    winnerTags.appendChild(document.createTextNode(filterText));
    winnerTags.appendChild(document.createElement('br'));
    const participantLabel = document.createElement('span');
    participantLabel.className = 'fw-semibold';
    participantLabel.textContent = '得獎者標籤：';
    winnerTags.appendChild(participantLabel);
    winnerTags.appendChild(document.createTextNode(participantTags));
  }

  function updateWinnerCount() {
    winnerCount.textContent = `${state.winnerIds.size} 位中獎者`;
  }

  function updatePrizeRemainingHint() {
    if (!prizeRemainingHint) return;
    if (!state.prizes.length) {
      prizeRemainingHint.textContent = '';
      return;
    }

    const totalQuantity = getTotalPrizeQuantity();
    const totalRemaining = getTotalPrizeRemaining();

    if (totalRemaining <= 0) {
      prizeRemainingHint.textContent = '所有獎項皆已抽完';
    } else {
      prizeRemainingHint.textContent = `剩餘 ${totalRemaining} / ${totalQuantity} 份`;
    }
  }

  function updateDrawButtonState() {
    const hasParticipants = state.participants.length > state.winnerIds.size;
    const hasPrize = state.prizes.some((prize) => prize.quantity - prize.awarded > 0);
    const selectedPrize = getSelectedPrize();
    const prizeAvailable = Boolean(selectedPrize && selectedPrize.quantity - selectedPrize.awarded > 0);
    drawButton.disabled = !(hasParticipants && hasPrize && prizeAvailable);
  }

  function displayTag(normalizedTag) {
    return state.tagDictionary.get(normalizedTag) || normalizedTag;
  }

  function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function startRollingEffect(participants, displayElement) {
    if (!displayElement) return null;
    let index = 0;
    return setInterval(() => {
      displayElement.textContent = participants[index % participants.length].name;
      index += 1;
    }, 120);
  }

  function setDrawButtonLoading(loading) {
    if (loading) {
      drawButton.disabled = true;
      drawButton.textContent = '抽獎中...';
    } else {
      drawButton.textContent = '開始抽獎';
    }
  }

  function showMessage(text, type) {
    if (!messageBox) return;
    messageBox.textContent = text;
    messageBox.className = `alert alert-${type} mt-3`;
  }

  function clearMessage() {
    if (!messageBox) return;
    messageBox.textContent = '';
    messageBox.className = 'alert mt-3 d-none';
  }

  function clearParticipants() {
    state.participants = [];
    participantSummary.innerHTML = '';
    participantTagsDisplay.innerHTML = '';
    rebuildTagDictionary();
    resetDrawState(true);
    renderTagFilters();
  }

  function clearPrizes() {
    state.prizes = [];
    prizeSummary.innerHTML = '';
    rebuildTagDictionary();
    resetDrawState(true);
    renderTagFilters();
  }

  function sanitizeImageUrl(value) {
    if (value === undefined || value === null) {
      return '';
    }
    const url = String(value).trim();
    return url;
  }

  function getTotalPrizeQuantity() {
    return state.prizes.reduce((sum, prize) => sum + prize.quantity, 0);
  }

  function getTotalPrizeRemaining() {
    return state.prizes.reduce((sum, prize) => sum + Math.max(prize.quantity - prize.awarded, 0), 0);
  }
});
