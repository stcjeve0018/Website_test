document.querySelectorAll('nav a').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href').substring(1);
      document.querySelectorAll('.page').forEach(page => {
        page.style.display = 'none';
      });
      document.getElementById(targetId).style.display = 'block';
    });
  });
  // 預設顯示首頁
  document.getElementById('home').style.display = 'block';