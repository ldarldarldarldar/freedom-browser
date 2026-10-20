const { spawn } = require('child_process');
const child = spawn('npx', ['electron', '.', '/home/royalxvii/Рабочий стол/NeonPyatov.html'], {
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' }
});

child.stdout.on('data', (d) => process.stdout.write('[STDOUT] ' + d));
child.stderr.on('data', (d) => process.stderr.write('[STDERR] ' + d));

setTimeout(() => {
  console.log('Sending kill signal...');
  child.kill();
  process.exit(0);
}, 4000);
