document.addEventListener('DOMContentLoaded', () => {
  const navLinks = document.querySelectorAll('nav a');
  const pages = document.querySelectorAll('.page');

  showPage('home');

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const pageId = link.getAttribute('href').substring(1);
      showPage(pageId);
    });
  });

  window.addEventListener('popstate', () => {
    const hash = window.location.hash.substring(1) || 'home';
    showPage(hash);
  });
});

function showPage(pageId) {
  const pages = document.querySelectorAll('.page');
  pages.forEach(page => page.style.display = 'none');
  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.style.display = 'block';
  }
  if (window.location.hash !== `#${pageId}`) {
    history.pushState(null, null, `#${pageId}`);
  }
}