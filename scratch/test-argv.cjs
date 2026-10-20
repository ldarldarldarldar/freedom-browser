const { app } = require('electron');
console.log('TEST-ARGV process.argv:', process.argv);
console.log('TEST-ARGV cwd:', process.cwd());
setTimeout(() => app.quit(), 500);
