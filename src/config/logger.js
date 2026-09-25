import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_DIR = path.join(__dirname, '../../../logs');
const LOG_FILE = path.join(LOG_DIR, 'server.log');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Logger helper to serialize logs into a file
const writeToFile = (level, args) => {
  try {
    const time = new Date().toISOString();
    const message = args.map(arg => {
      if (arg instanceof Error) {
        return `${arg.message}\nStack: ${arg.stack}`;
      }
      return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
    }).join(' ');

    const logEntry = `[${time}] [${level}] ${message}\n`;
    fs.appendFileSync(LOG_FILE, logEntry);
  } catch (e) {
    // Fail-safe print to stderr in case file writing fails
    process.stderr.write(`[LOGGER ERROR] Failed to write log to file: ${e.message}\n`);
  }
};

// Backup original console functions
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

// Override console methods to stream to file automatically
console.log = (...args) => {
  // Silent in the developer console/terminal, but saved to background log file
  writeToFile('INFO', args);
};

console.error = (...args) => {
  // Print errors to the terminal so they are immediately visible
  originalError.apply(console, args);
  writeToFile('ERROR', args);
};

console.warn = (...args) => {
  // Silent in the developer console/terminal, but saved to background log file
  writeToFile('WARN', args);
};


// Export logger wrapper matching interface
export const logger = {
  info(...args) {
    console.log(...args);
  },
  error(msg, err) {
    if (err) {
      console.error(`${msg} - ${err.message || err}`, err);
    } else {
      console.error(msg);
    }
  }
};
console.log(`📝 Centralized file logger initialized. Stream redirected to: ${path.resolve(LOG_FILE)}`);
