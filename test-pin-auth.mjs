import { runPinAuthTests } from './src/services/pdvPinAuthService.ts';

console.log('--- EXECUTANDO TESTES DO SISTEMA DE AUTENTICAÇÃO DO PIN ---');
const report = await runPinAuthTests();

report.results.forEach((res) => {
  if (res.passed) {
    console.log(`✅ [PASS] ${res.name}`);
  } else {
    console.error(`❌ [FAIL] ${res.name}`);
    console.error(`   Erro:`, res.error);
  }
});

console.log(`\nResultado Final: ${report.passedCount}/${report.totalCount} testes passaram (${report.allPassed ? '100% SUCESSO' : 'FALHA'}).`);
if (!report.allPassed) {
  process.exit(1);
}
