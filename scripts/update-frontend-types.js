const fs = require('fs');
let content = fs.readFileSync('flow-frontend/src/app/types/flow-state.ts', 'utf8');

// Add lifecycle field to peaks type (frontend)
content = content.replace(
  `peaks: { time: string; zone: string; reason: string; score: number }[];`,
  `peaks: { time: string; zone: string; reason: string; score: number; lifecycle?: 'maintenant' | 'prochain' | 'ce_soir' }[];`
);

fs.writeFileSync('flow-frontend/src/app/types/flow-state.ts', content);
console.log('Frontend flow-state.ts updated with lifecycle field');
