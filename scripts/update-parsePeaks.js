const fs = require('fs');
let content = fs.readFileSync('src/lib/flow-engine/flow-state-adapter.ts', 'utf8');

// Update the second peaks.push to include venue and affluence from hotspot data
content = content.replace(
  `const peakTime = start?.trim() ?? h.window;
    peaks.push({
      time: peakTime,
      zone: h.zone,
      reason: h.why ?? '',
      score: h.score ?? 70,
      lifecycle: computeEventLifecycle(peakTime),
    })`,
  `const peakTime = start?.trim() ?? h.window;
    // Parse attendance from "why" field (e.g., "Concert Name 5000 pers")
    const whyText = h.why ?? '';
    const attendanceMatch = whyText.match(/(\\d+)\\s*pers/);
    const attendance = attendanceMatch ? parseInt(attendanceMatch[1]) : null;
    // Compute affluence range: attendance * 0.35 to 0.7 for exit flow
    const affluence = attendance
      ? attendance >= 5000
        ? \`~\${Math.round(attendance * 0.35 / 1000)}k-\${Math.round(attendance * 0.7 / 1000)}k sorties\`
        : \`~\${Math.round(attendance * 0.35)}-\${Math.round(attendance * 0.7)} sorties\`
      : undefined;

    peaks.push({
      time: peakTime,
      zone: h.zone,
      reason: whyText,
      score: h.score ?? 70,
      lifecycle: computeEventLifecycle(peakTime),
      venue: h.zone, // zone is often the venue for events
      affluence,
    })`
);

fs.writeFileSync('src/lib/flow-engine/flow-state-adapter.ts', content);
console.log('flow-state-adapter.ts updated with venue/affluence in parsePeaks');
