// Run after npm install: node scripts/test-catalog-search.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const src = fs.readFileSync('src/lib/customerCatalogSearch.ts', 'utf8');
const js = ts.transpileModule(src, {
  fileName: 'customerCatalogSearch.ts',
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const mod = { exports: {} };
vm.runInNewContext(js, { module: mod, exports: mod.exports });
const { searchCustomerCatalog: search } = mod.exports;
const product = (name, extras = {}) => ({
  id: name, name, active: true, images: [{ url: 'https://example.org/photo.webp' }],
  stock: 5, sku: '123', categoryId: 'cosmetics', extras: { showInCatalog: true }, ...extras
});
const all = [
  product('Gel íntimo'), product('Lubrificante em gel'),
  product('Angel massageador'), product('Gelatina corporal'),
  product('Vibrador de silicone', { ai_keywords: ['gel'] }),
  product('Gel zerado', { stock: 0 }),
  product('Gel sem imagem', { images: [] }),
  product('Gel inativo', { active: false }),
  product('Gel escondido', { extras: { showInCatalog: false } })
];
const categories = { cosmetics: 'Cosméticos' };
const names = (q) => Array.from(search(all, q, categories), p => p.name);
assert.deepEqual(names('gel'), ['Gel íntimo', 'Lubrificante em gel']);
assert.deepEqual(names('GÉL'), names('gel'));
assert.deepEqual(names('lubrificante gel'), ['Lubrificante em gel']);
assert.deepEqual(names('angel'), ['Angel massageador']);
assert.deepEqual(names('gelatina'), ['Gelatina corporal']);
assert.equal(search([product('Produto genérico', { sku: '789123456' })], '789123456').length, 1);
assert.equal(search([product('Produto genérico', { categoryId: 'lub' })], 'lubrificante', { lub: 'Lubrificantes' }).length, 1);
console.log('PASS: 7 customer search scenarios, strict visibility, SKU and category.');
