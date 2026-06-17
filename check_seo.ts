async function check() {
  async function fetchAndLog(url) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      console.log(`\n=== URL: ${url} (Status: ${res.status}) ===`);
      const matches = text.match(/<meta property="og:.*?" content=".*?" \/>/g);
      console.log(matches ? matches.join('\n') : 'No og tags found');
      
      const titleMatch = text.match(/<title>.*?<\/title>/);
      console.log(titleMatch ? titleMatch[0] : 'No title found');

      const canonicalMatch = text.match(/<link rel="canonical" href=".*?" \/>/);
      console.log(canonicalMatch ? canonicalMatch[0] : 'No canonical found');

      const robotsMatch = text.match(/<meta name="robots" content=".*?" \/>/);
      console.log(robotsMatch ? robotsMatch[0] : 'No robots found');

    } catch(e) {
      console.log(`Error on ${url}:`, e.message);
    }
  }

  await fetchAndLog('http://127.0.0.1:3000/');
  await fetchAndLog('http://127.0.0.1:3000/login');
}
check();
