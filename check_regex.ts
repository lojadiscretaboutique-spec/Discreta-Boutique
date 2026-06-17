import fs from 'fs';
import path from 'path';

async function check() {
  let html = await fs.promises.readFile(path.resolve(process.cwd(), 'index.html'), 'utf-8');
  console.log("Original Title:", html.match(/<title>.*?<\/title>/));
  
  const title = "New Title Test";
  const ogTags = '<meta name="test" content="123" />';
  
  html = html.replace(/<title>[^<]+<\/title>/, `<title>${title}</title>`);
  html = html.replace('</title>', '</title>\n' + ogTags);
  
  console.log("Replaced:", html.includes("New Title Test"));
  console.log("Replaced tag:", html.includes("content=\"123\""));
}
check();
