const { execSync } = require('child_process');

console.log('Staging files...');
execSync('git add -A', { stdio: 'inherit' });

console.log('Committing fixes...');
const out = execSync('git commit -m "fix: sse race condition, path traversal and openai-compat provider"').toString();
console.log(out);
