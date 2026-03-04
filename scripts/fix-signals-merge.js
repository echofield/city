const fs = require('fs');
let content = fs.readFileSync('flow-frontend/src/app/components/Dashboard.tsx', 'utf8');

content = content.replace(
  `hasEverSucceededRef.current = true;
        setFlowState(state);
        setDataSource("live");`,
  `hasEverSucceededRef.current = true;
        // Merge locally-computed signals (metro status) with API signals
        const localSignals = computeContextSignals();
        const mergedSignals = [...localSignals, ...(state.signals ?? [])];
        setFlowState({ ...state, signals: mergedSignals });
        setDataSource("live");`
);

fs.writeFileSync('flow-frontend/src/app/components/Dashboard.tsx', content);
console.log('Dashboard.tsx updated to merge local signals');
