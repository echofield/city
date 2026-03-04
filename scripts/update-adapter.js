const fs = require('fs');
let content = fs.readFileSync('src/lib/flow-engine/flow-state-adapter.ts', 'utf8');

// Add lifecycle computation helper function before parsePeaks
const lifecycleHelper = `
/**
 * Compute event lifecycle based on time difference from now.
 * - maintenant: within 15min of event
 * - prochain: 15-30min before event
 * - ce_soir: >30min before event
 */
function computeEventLifecycle(eventTime: string): 'maintenant' | 'prochain' | 'ce_soir' {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // Parse time like "23h15" or "01:00" or "23h"
  let hours = 0, mins = 0;
  if (eventTime.includes('h')) {
    const parts = eventTime.split('h');
    hours = parseInt(parts[0]) || 0;
    mins = parseInt(parts[1]) || 0;
  } else if (eventTime.includes(':')) {
    const parts = eventTime.split(':');
    hours = parseInt(parts[0]) || 0;
    mins = parseInt(parts[1]) || 0;
  } else {
    hours = parseInt(eventTime) || 0;
  }

  // Handle cross-midnight (if event is 00-06 and now is evening, it's tomorrow)
  let eventDate = new Date(\`\${today}T\${String(hours).padStart(2, '0')}:\${String(mins).padStart(2, '0')}:00\`);
  if (hours < 6 && now.getHours() >= 18) {
    eventDate.setDate(eventDate.getDate() + 1);
  }

  const diffMs = eventDate.getTime() - now.getTime();
  const diffMins = diffMs / 60000;

  if (diffMins <= 15) return 'maintenant';
  if (diffMins <= 30) return 'prochain';
  return 'ce_soir';
}

`;

// Insert helper before parsePeaks function
content = content.replace(
  'function parsePeaks(brief: CompiledBrief): FlowState[\'peaks\'] {',
  lifecycleHelper + 'function parsePeaks(brief: CompiledBrief): FlowState[\'peaks\'] {'
);

// Update the first peaks.push to include lifecycle
content = content.replace(
  `peaks.push({
      time: time.length <= 2 ? \`\${time}h\` : time.replace(':', 'h'),
      zone,
      reason: '',
      score: 75,
    })`,
  `const formattedTime = time.length <= 2 ? \`\${time}h\` : time.replace(':', 'h');
    peaks.push({
      time: formattedTime,
      zone,
      reason: '',
      score: 75,
      lifecycle: computeEventLifecycle(formattedTime),
    })`
);

// Update the second peaks.push to include lifecycle
content = content.replace(
  `peaks.push({
      time: start?.trim() ?? h.window,
      zone: h.zone,
      reason: h.why ?? '',
      score: h.score ?? 70,
    })`,
  `const peakTime = start?.trim() ?? h.window;
    peaks.push({
      time: peakTime,
      zone: h.zone,
      reason: h.why ?? '',
      score: h.score ?? 70,
      lifecycle: computeEventLifecycle(peakTime),
    })`
);

fs.writeFileSync('src/lib/flow-engine/flow-state-adapter.ts', content);
console.log('flow-state-adapter.ts updated with lifecycle computation');
