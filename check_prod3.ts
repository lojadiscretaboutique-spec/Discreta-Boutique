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

  await fetchAndLog('http://127.0.0.1:3000/robots.txt');
  await fetchAndLog('http://127.0.0.1:3000/sitemap.xml');
  await fetchAndLog('http://127.0.0.1:3000/');
  await fetchAndLog('http://127.0.0.1:3000/login');
  await fetchAndLog('http://127.0.0.1:3000/manifest.webmanifest');
}
check();
