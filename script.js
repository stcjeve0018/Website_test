document.addEventListener('DOMContentLoaded', () => {
  const navLinks = document.querySelectorAll('nav a');
  const pages = document.querySelectorAll('.page');

  // 初始展示首頁並更新網址
  showPage('home');

  // 監聽導航連結點擊
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault(); // 阻止默認錨點跳轉
      const pageId = link.getAttribute('href').substring(1); // 獲取 # 後的 ID，例如 "home"
      showPage(pageId);
    });
  });

  // 處理瀏覽器歷史記錄（popstate 事件）
  window.addEventListener('popstate', () => {
    const hash = window.location.hash.substring(1) || 'home'; // 獲取 URL 中的 # 後內容，無則預設首頁
    showPage(hash);
  });
});

function showPage(pageId) {
  // 隱藏所有分頁
  const pages = document.querySelectorAll('.page');
  pages.forEach(page => page.style.display = 'none');

  // 顯示目標分頁
  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.style.display = 'block';
  }

  // 更新網址但不刷新頁面
  if (window.location.hash !== `#${pageId}`) {
    history.pushState(null, null, `#${pageId}`); // 更新網址為 #home、#services 等
  }
}