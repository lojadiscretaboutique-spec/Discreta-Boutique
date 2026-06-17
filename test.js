fetch('http://127.0.0.1:3000/api/admin/fix-category-slugs')
  .then(r => r.json())
  .then(data => console.log(JSON.stringify(data, null, 2)))
  .catch(console.error);
