// One-off: rewrite product descriptions with correct UTF-8 French.
// The previous descriptions were stored with broken encoding (U+FFFD), which is
// lossy and not recoverable, so we replace them with clean text matched by name.
// Run: node scripts/fix-descriptions.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
function loadEnv(file) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv('.env.local'); loadEnv('.env');
const URI = process.env.MONGODB_URI;
if (!URI) { console.error('MONGODB_URI manquant'); process.exit(1); }

const SHORT = 'Édition limitée — OLD MONEY × STREET WEAR.';

const DESCRIPTIONS = {
  'Pack all outfit': "Le Pack all outfit Shiraly est l'ensemble parfait pour un look old money élégant. Il comprend un polo au choix (noir ou beige) et un pantalon (Kamraya ou wide-leg). Tissu premium, coupe soignée et finitions de qualité pour une allure raffinée, au quotidien comme lors des occasions spéciales.",
  'KAMRAYA PANTS': "Le KAMRAYA PANTS Shiraly est un pantalon à coupe moderne qui incarne l'élégance old money tunisienne. Tissu premium et coupe parfaite pour un look sophistiqué. Disponible en plusieurs tailles. Parfait pour les occasions spéciales ou le quotidien, avec une touche de raffinement discret.",
  'wide-leg TROUSERS': "Le wide-leg TROUSERS Shiraly allie confort et style old money. Sa coupe large et décontractée en fait un choix incontournable pour une allure moderne et élégante. Tissu premium et finitions soignées pour un rendu impeccable.",
  'knit polo black': "Le knit polo black Shiraly est l'indispensable de la collection Old Money. Ce polo noir en maille premium offre un confort exceptionnel et une élégance discrète. Parfait pour toutes les occasions.",
  'polo knit beige': "Le polo knit beige Shiraly incarne l'élégance old money dans sa plus pure expression. Sa couleur beige camel s'associe parfaitement avec tout votre dressing. En maille premium pour un confort optimal.",
  'LEATHER JACKET BROWN': "La LEATHER JACKET BROWN Shiraly est une veste en cuir marron premium qui définit le style old money. Cuir de première qualité, coupe impeccable et finitions soignées pour une pièce intemporelle.",
  'LEATHER JACKET BLACK': "La LEATHER JACKET BLACK Shiraly est l'icône de la collection Old Money. Cette veste en cuir noir premium allie élégance intemporelle et modernité. Confectionnée avec un cuir de qualité supérieure.",
  'black hoddie': "Le black hoddie Shiraly réinvente le streetwear avec une touche old money. Ce hoodie noir premium offre confort et style pour un look urbain sophistiqué. Parfait pour le quotidien.",
  'GRIS JEAN PANTS': "Le GRIS JEAN PANTS Shiraly est le pantalon en jean gris qui manquait à votre dressing old money. Coupe moderne, tissu premium et finitions impeccables. Idéal pour un look décontracté et raffiné.",
  'BROWN STAR hoddie': "Le BROWN STAR hoddie Shiraly se distingue par son motif étoile unique et sa couleur marron camel. Ce hoodie old money apporte une touche d'originalité à votre garde-robe. Confort premium garanti.",
  'crop cut t shirt': "Le crop cut t shirt Shiraly est le t-shirt tendance de la collection Old Money. Sa coupe crop unique apporte une touche moderne à votre look. Parfait pour les journées décontractées.",
};

async function main() {
  await mongoose.connect(URI, { bufferCommands: false });
  const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }), 'products');
  let updated = 0;
  for (const [name, description] of Object.entries(DESCRIPTIONS)) {
    const res = await Product.updateOne({ name }, { $set: { description, shortDescription: SHORT } });
    if (res.matchedCount) { updated++; console.log('fixed:', name); }
    else console.warn('NOT FOUND:', name);
  }
  // Safety net: blank out any remaining replacement chars elsewhere
  const leftover = await Product.find({ description: /�/ }, { name: 1 }).lean();
  if (leftover.length) console.warn('Still has U+FFFD:', leftover.map((d) => d.name));
  console.log(`\nDone. ${updated} products updated.`);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
