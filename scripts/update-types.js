const fs = require('fs');
let content = fs.readFileSync('src/types/flow-state.ts', 'utf8');

// Add lifecycle field to peaks type
content = content.replace(
  `peaks: {
    time: string;
    zone: string;
    reason: string;
    score: number;`,
  `peaks: {
    time: string;
    zone: string;
    reason: string;
    score: number;
    /** Event lifecycle: which tab should show this event */
    lifecycle?: 'maintenant' | 'prochain' | 'ce_soir';`
);

fs.writeFileSync('src/types/flow-state.ts', content);
console.log('flow-state.ts updated with lifecycle field');
