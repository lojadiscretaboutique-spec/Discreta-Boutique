import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from './src/lib/firebase';
async function test() {
  const q = collection(db, 'products');
  const snap = await getDocs(q);
  for (const d of snap.docs.slice(0, 5)) {
    const vSnap = await getDocs(collection(db, `products/${d.id}/variants`));
    console.log(d.id, d.data().name, d.data().hasVariants, 'variants count:', vSnap.docs.length);
  }
  process.exit(0);
}
test();
