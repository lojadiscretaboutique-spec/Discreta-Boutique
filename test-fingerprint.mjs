import { runCartFingerprintTests } from './src/services/pdvCartFingerprint.ts';

console.log('--- EXECUTANDO TESTES DE FINGERPRINT DO CARRINHO ---');
const report = await runCartFingerprintTests();

report.results.forEach((res) => {
  if (res.passed) {
    console.log(`✅ [PASS] ${res.name}`);
  } else {
    console.error(`❌ [FAIL] ${res.name}`);
    console.error(`   Detalhes:`, res.details);
  }
});

console.log(`\nResultado Final: ${report.results.filter(r => r.passed).length}/${report.results.length} testes passaram (${report.allPassed ? '100% SUCESSO' : 'FALHA'}).`);
if (!report.allPassed) {
  process.exit(1);
}
