import { app } from './src/lib/firebase';
import { getFirestore, collection, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';

const db = getFirestore(app);

async function cleanSlugs() {
  const catRef = collection(db, 'categories');
  const catSnap = await getDocs(catRef);

  let beforeCount = 0;
  let afterCount = 0;
  let duplicadas = 0;
  let corrigidas = 0;
  
  const beforeUrls: string[] = [];
  const afterUrls: Set<string> = new Set();
  const logs: string[] = [];
  
  const batch = writeBatch(db);
  let batchCount = 0;

  catSnap.docs.forEach(docSnap => {
    const data = docSnap.data();
    const id = docSnap.id;
    const rawUrl = data.slug || docSnap.id;
    beforeUrls.push(rawUrl);
    beforeCount++;
    
    let rawSlug = data.slug || data.name || docSnap.id;
    
    let cleanSlug = rawSlug.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, "") // remove acentos
      .replace(/[+&%?\/!,()]/g, "") // remove símbolos principais
      .trim() // remove espaco comeco/fim
      .replace(/\s+/g, '-') // espaco p/ hifen
      .replace(/-+/g, '-') // multiplos hifens p/ unico
      .replace(/^-+|-+$/g, ''); // remove hifen inicio/fim

    if (!cleanSlug) {
      cleanSlug = id.toLowerCase().replace(/[^a-z0-9-]/g, '');
    }

    if (rawUrl !== cleanSlug) {
        corrigidas++;
        logs.push(`Corrigida: '${rawUrl}' -> '${cleanSlug}'`);
        batch.update(doc(db, 'categories', id), { slug: cleanSlug });
        batchCount++;
    }

    if (afterUrls.has(cleanSlug)) {
        duplicadas++;
    } else {
        afterUrls.add(cleanSlug);
    }
  });

  if (batchCount > 0) {
      await batch.commit();
      console.log(`Updated ${batchCount} categories in database.`);
  }

  afterCount = afterUrls.size;

  console.log("=== RELATÓRIO ===");
  console.log(`Quantidade de URLs antes: ${beforeCount}`);
  console.log(`Quantidade de URLs depois: ${afterCount}`);
  console.log(`Categorias corrigidas (atualizadas no DB): ${corrigidas}`);
  console.log(`Duplicadas removidas: ${duplicadas}`);
  console.log("");
  console.log("Categorias corrigidas detalhe:");
  logs.forEach(l => console.log(l));
  
  console.log("");
  console.log("Exemplo real de URLs geradas (5 primeiras):");
  const sample = Array.from(afterUrls).slice(0, 5);
  sample.forEach(s => console.log(`https://discretaboutique.com.br/categoria/${s}`));
  
}

cleanSlugs().catch(console.error);
