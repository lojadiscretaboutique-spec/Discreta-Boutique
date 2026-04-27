const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('src/pages/admin');
files.push('src/layouts/AdminLayout.tsx');

const replacements = [
    { regex: /\bbg-white\b/g, replacement: 'bg-slate-900' },
    { regex: /\bbg-slate-50\b/g, replacement: 'bg-slate-800' },
    { regex: /\bbg-slate-100\b/g, replacement: 'bg-slate-950' },
    { regex: /\bbg-gray-50\b/g, replacement: 'bg-slate-800' },
    { regex: /\bbg-gray-100\b/g, replacement: 'bg-slate-950' },
    { regex: /\bbg-slate-200\/50\b/g, replacement: 'bg-slate-800/50' },
    { regex: /\btext-slate-900\b/g, replacement: 'text-white' },
    { regex: /\btext-slate-800\b/g, replacement: 'text-slate-100' },
    { regex: /\btext-slate-700\b/g, replacement: 'text-slate-200' },
    { regex: /\btext-slate-600\b/g, replacement: 'text-slate-300' },
    { regex: /\btext-slate-500\b/g, replacement: 'text-slate-400' },
    { regex: /\btext-gray-900\b/g, replacement: 'text-white' },
    { regex: /\btext-gray-800\b/g, replacement: 'text-slate-100' },
    { regex: /\bborder-slate-200\b/g, replacement: 'border-slate-800' },
    { regex: /\bborder-slate-300\b/g, replacement: 'border-slate-700' },
    { regex: /\bborder-gray-200\b/g, replacement: 'border-slate-800' },
    { regex: /\bdivide-slate-200\b/g, replacement: 'divide-slate-800' },
    { regex: /\bhover:bg-slate-50\b/g, replacement: 'hover:bg-slate-800' },
    { regex: /\bhover:bg-slate-100\b/g, replacement: 'hover:bg-slate-800' },
    { regex: /\bactive:bg-slate-100\b/g, replacement: 'active:bg-slate-800' },
    { regex: /\btext-black\b/g, replacement: 'text-white' }
];

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    replacements.forEach(r => {
        content = content.replace(r.regex, r.replacement);
    });
    
    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated ${file}`);
    }
});
