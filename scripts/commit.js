const { execSync } = require('child_process');

console.log('Staging files...');
execSync('git add -A', { stdio: 'inherit' });

console.log('Committing Phase 4...');
const out = execSync('git commit -m "phase 4: ui"').toString();
console.log(out);
