async function check() {
  const res = await fetch('http://127.0.0.1:3000/produto/qualquer');
  const text = await res.text();
  console.log(`\n=== URL: /produto/qualquer (Status: ${res.status}) ===`);
  const matches = text.match(/<meta property="og:.*?" content=".*?" \/>/g);
  console.log(matches ? matches.join('\n') : 'No og tags found');
  const titleMatch = text.match(/<title>.*?<\/title>/);
  console.log(titleMatch ? titleMatch[0] : 'No title found');
  const robotsMatch = text.match(/<meta name="robots" content=".*?" \/>/);
  console.log(robotsMatch ? robotsMatch[0] : 'No robots found');
  // Check JSON-LD
  console.log(text.includes('application/ld+json') ? 'JSON-LD PRESENT' : 'NO JSON-LD');
}
check();
