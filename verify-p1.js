const fs = require('fs');
const omnirouteCode = fs.readFileSync('./omniroute.js', 'utf8');

// Check for P1 functions
const checks = [
  { name: 'hgOmniRegimeScore', pattern: /function hgOmniRegimeScore\(setup\)/ },
  { name: 'hgOmniAtrExpansionScore', pattern: /function hgOmniAtrExpansionScore\(setup\)/ },
  { name: 'hgOmniSessionTimingScore', pattern: /function hgOmniSessionTimingScore\(setup, horizonLabel\)/ },
  { name: 'hgOmniSolidityScore (updated)', pattern: /function hgOmniSolidityScore\(setup, horizonLabel\)/ },
  { name: 'P1 exports', pattern: /window\.hgOmniRegimeScore = hgOmniRegimeScore/ },
  { name: 'P1 breakdown', pattern: /regime: \{ score: regimeScore\.score/ },
  { name: 'P0 integrity', pattern: /window\.hgOmniOrderBlockScore = hgOmniOrderBlockScore/ }
];

console.log('P1 IMPLEMENTATION VERIFICATION');
console.log('═'.repeat(50));

let allPassed = true;
checks.forEach(check => {
  const found = check.pattern.test(omnirouteCode);
  console.log(`${found ? '✓' : '✗'} ${check.name}`);
  if (!found) allPassed = false;
});

console.log('═'.repeat(50));
console.log(allPassed ? 'ALL CHECKS PASSED ✓' : 'SOME CHECKS FAILED ✗');
