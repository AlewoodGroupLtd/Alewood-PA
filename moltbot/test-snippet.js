import fs from 'fs';

const xml = fs.readFileSync('test-rss.xml', 'utf16le');
const itemRegex = /<item>([\s\S]*?)<\/item>/g;
let itemMatch;
let count = 0;

while ((itemMatch = itemRegex.exec(xml)) !== null && count < 2) {
  const itemContent = itemMatch[1];
  const descMatch = /<description>([\s\S]*?)<\/description>/.exec(itemContent);
  const snippet = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim() : '';
  console.log("Snippet " + count + ":", snippet);
  console.log("CleanSnippet " + count + ":", (snippet || '').replace(/<[^>]+>/g, ''));
  
  // Decoding test
  const decoded = descMatch[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"');
  const cleanSnippet2 = decoded.replace(/<[^>]+>/g, '').trim();
  console.log("Better clean snippet " + count + ":", cleanSnippet2);
  
  count++;
}
