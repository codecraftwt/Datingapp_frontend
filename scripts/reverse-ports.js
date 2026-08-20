const { execSync } = require('child_process');

try {
  const devicesOutput = execSync('adb devices', { encoding: 'utf8' });
  const lines = devicesOutput.split('\n').filter(line => line.includes('\tdevice'));

  if (lines.length === 0) {
    console.log('[reverse-ports] No connected ADB devices found.');
  } else {
    lines.forEach(line => {
      const deviceId = line.split('\t')[0].trim();
      if (deviceId) {
        console.log(`[reverse-ports] Setting up ports for device: ${deviceId}`);
        try {
          execSync(`adb -s ${deviceId} reverse tcp:5000 tcp:5000`);
          execSync(`adb -s ${deviceId} reverse tcp:9090 tcp:9090`);
          console.log(`[reverse-ports] Successfully reversed tcp:5000 and tcp:9090 on ${deviceId}`);
        } catch (err) {
          console.warn(`[reverse-ports] Could not reverse ports on ${deviceId}: ${err.message}`);
        }
      }
    });
  }
} catch (err) {
  console.warn('[reverse-ports] ADB execution warning:', err.message);
}
