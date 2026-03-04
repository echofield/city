const fs = require('fs');

// Update backend flow-state.ts
let backendTypes = fs.readFileSync('src/types/flow-state.ts', 'utf8');
backendTypes = backendTypes.replace(
  `/** Event lifecycle: which tab should show this event */
    lifecycle?: 'maintenant' | 'prochain' | 'ce_soir';`,
  `/** Event lifecycle: which tab should show this event */
    lifecycle?: 'maintenant' | 'prochain' | 'ce_soir';
    /** Venue name if available */
    venue?: string;
    /** Affluence range estimate (e.g., "~2k-6k sorties") */
    affluence?: string;`
);
fs.writeFileSync('src/types/flow-state.ts', backendTypes);
console.log('Backend types updated with venue/affluence');

// Update frontend flow-state.ts
let frontendTypes = fs.readFileSync('flow-frontend/src/app/types/flow-state.ts', 'utf8');
frontendTypes = frontendTypes.replace(
  `peaks: { time: string; zone: string; reason: string; score: number; lifecycle?: 'maintenant' | 'prochain' | 'ce_soir' }[];`,
  `peaks: { time: string; zone: string; reason: string; score: number; lifecycle?: 'maintenant' | 'prochain' | 'ce_soir'; venue?: string; affluence?: string }[];`
);
fs.writeFileSync('flow-frontend/src/app/types/flow-state.ts', frontendTypes);
console.log('Frontend types updated with venue/affluence');
