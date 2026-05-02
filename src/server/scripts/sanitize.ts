import fs from 'fs';
import path from 'path';

async function sanitizeBuscas() {
  const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf-8'));
  const projectId = config.projectId;
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/intelligent_searches`;

  const validCategories = ["Cosméticos", "Fantasias", "Lingeries", "Masturbadores", "Plugs", "Próteses", "Sado", "Vibradores", "Outros"];
  const mappings: Record<string, string> = {
    "bem-estar íntimo": "Cosméticos",
    "romântico": "Lingeries"
  };

  try {
    const resp = await fetch(baseUrl + '?pageSize=1000');
    if (!resp.ok) throw new Error('Failed to fetch docs');
    const data = await resp.json();
    const docs = data.documents || [];

    console.log(`Checking ${docs.length} documents...`);

    const stats = { fixed: 0, invalid: 0 };

    for (const doc of docs) {
      const name = doc.name;
      const fields = doc.fields;
      if (!fields.categoria) continue;

      const categoria = fields.categoria.stringValue;
      if (validCategories.includes(categoria)) continue;

      let newCategoria = 'Outros';
      if (mappings[categoria.toLowerCase()]) {
        newCategoria = mappings[categoria.toLowerCase()];
      }

      console.log(`Fixing ${name}: ${categoria} -> ${newCategoria}`);
      stats.fixed++;

      const updateUrl = `https://firestore.googleapis.com/v1/${name}?updateMask.fieldPaths=categoria`;
      await fetch(updateUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { categoria: { stringValue: newCategoria } } })
      });
    }

    console.log(`Done. Fixed ${stats.fixed} documents.`);
  } catch (err) {
    console.error('Error:', err);
  }
}

sanitizeBuscas();
