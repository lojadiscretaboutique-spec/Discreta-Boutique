async function check() {
  async function fetchAndLog(url) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      console.log(`\n=== URL: ${url} (Status: ${res.status}) ===`);
      console.log(text.slice(0, 500));
    } catch(e) {
      console.log(`Error on ${url}:`, e.message);
    }
  }

  await fetchAndLog('https://discretaboutique.com.br/robots.txt');
  await fetchAndLog('https://discretaboutique.com.br/sitemap.xml');
  await fetchAndLog('https://discretaboutique.com.br/');
  await fetchAndLog('https://discretaboutique.com.br/login');
}
check();
