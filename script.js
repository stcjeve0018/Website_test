document.addEventListener('DOMContentLoaded', () => {
  const lotteryForm = document.getElementById('lottery-form');
  const participantsInput = document.getElementById('participants');
  const prizeInput = document.getElementById('prize');
  const winnerName = document.getElementById('winner-name');
  const prizeName = document.getElementById('prize-name');
  const messageBox = document.getElementById('lottery-message');
  const historyList = document.getElementById('history-list');
  const drawButton = document.getElementById('draw-button');

  if (!lotteryForm) {
    return;
  }

  lotteryForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const participants = sanitizeList(participantsInput ? participantsInput.value : '');
    const prize = prizeInput ? prizeInput.value.trim() : '';

    if (participants.length === 0) {
      showMessage('請先輸入至少一位參與者。', 'danger');
      return;
    }

    if (!prize) {
      showMessage('請輸入獎項名稱。', 'danger');
      return;
    }

    disableDrawButton(true);
    showMessage('抽獎進行中，請稍候...', 'info');

    const rollingInterval = startRollingEffect(participants, winnerName);

    setTimeout(() => {
      clearInterval(rollingInterval);
      const winner = pickRandom(participants);
      if (winnerName) {
        winnerName.textContent = winner;
      }

      if (prizeName) {
        prizeName.textContent = `🎁 ${prize}`;
      }

      appendHistoryEntry(historyList, winner, prize);
      showMessage(`${winner} 恭喜獲得「${prize}」！`, 'success');
      disableDrawButton(false);
    }, 1800);
  });

  lotteryForm.addEventListener('reset', () => {
    if (winnerName) {
      winnerName.textContent = '尚未抽獎';
    }

    if (prizeName) {
      prizeName.textContent = '';
    }

    if (messageBox) {
      messageBox.className = 'alert mt-3 d-none';
      messageBox.textContent = '';
    }
  });

  function sanitizeList(rawValue) {
    return rawValue
      .split(/[\n,]/)
      .map(name => name.trim())
      .filter(Boolean);
  }

  function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function showMessage(text, type) {
    if (!messageBox) return;
    messageBox.textContent = text;
    messageBox.className = `alert alert-${type} mt-3`;
  }

  function appendHistoryEntry(listElement, winner, prize) {
    if (!listElement) return;
    const item = document.createElement('li');
    const timeStamp = new Date().toLocaleString();
    item.className = 'list-group-item d-flex justify-content-between align-items-center';
    item.innerHTML = `<span><strong>${winner}</strong> 獲得「${prize}」</span><small class="text-muted">${timeStamp}</small>`;
    listElement.prepend(item);
  }

  function disableDrawButton(disabled) {
    if (!drawButton) return;
    drawButton.disabled = disabled;
    drawButton.textContent = disabled ? '抽獎中...' : '開始抽獎';
  }

  function startRollingEffect(participants, displayElement) {
    if (!displayElement) return null;
    const interval = setInterval(() => {
      displayElement.textContent = pickRandom(participants);
    }, 120);
    return interval;
  }
});
