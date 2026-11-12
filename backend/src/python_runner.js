
const { spawn } = require('child_process');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const PYTHON_ROOT = path.join(PROJECT_ROOT, 'risk-ai');

function runPythonOperation(payload) {
  const python = process.env.PYTHON_EXECUTABLE ||
    (process.platform === 'win32' ? 'python' : 'python3');

  return new Promise((resolve, reject) => {
    const child = spawn(
      python,
      [path.join(PYTHON_ROOT, 'python_bridge.py')],
      { cwd: PYTHON_ROOT, windowsHide: true }
    );

    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (error) reject(error);
      else resolve(result);
    };

    const timer = setTimeout(() => {
      child.kill();
      finish(new Error('Python operation timed out'));
    }, 90000);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', chunk => {
      stdout += chunk;
    });

    child.stderr.on('data', chunk => {
      stderr += chunk;
    });

    child.on('error', error => {
      finish(error);
    });

    child.on('close', code => {
      if (code !== 0) {
        finish(new Error(
          `Python operation failed: ${stderr || stdout}`
        ));
        return;
      }

      try {
        const result = JSON.parse(stdout.trim());

        if (result.error) {
          finish(new Error(result.error));
          return;
        }

        finish(null, result);
      } catch (error) {
        finish(new Error(
          `Invalid Python response: ${error.message}`
        ));
      }
    });

    child.stdin.on('error', error => {
      finish(error);
    });

    child.stdin.end(JSON.stringify(payload));
  });
}

module.exports = { runPythonOperation };
