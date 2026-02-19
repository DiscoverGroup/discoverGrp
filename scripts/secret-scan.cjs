#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = new Set(process.argv.slice(2));
const stagedOnly = args.has('--staged');

function getFiles() {
  const cmd = stagedOnly
    ? 'git diff --cached --name-only --diff-filter=ACMRTUXB'
    : 'git ls-files';

  const output = execSync(cmd, { encoding: 'utf8' }).trim();
  if (!output) return [];

  return output
    .split(/\r?\n/)
    .map((f) => f.trim())
    .filter(Boolean)
    .filter((f) => !f.startsWith('node_modules/'))
    .filter((f) => !f.startsWith('docs/'))
    .filter((f) => !f.startsWith('reports/'))
    .filter((f) => !/\.md$/i.test(f));
}

function isLikelyText(filePath) {
  const binaryExt = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.gz', '.tar', '.tgz', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm'
  ]);

  return !binaryExt.has(path.extname(filePath).toLowerCase());
}

function isPlaceholder(value) {
  const v = String(value || '').trim();
  if (!v) return true;

  return /^(your[_-]|example|changeme|change_me|dummy|test|placeholder|<.+>|\$\{.+\})/i.test(v);
}

function isExampleFile(filePath) {
  const lower = filePath.toLowerCase();
  return lower.includes('.example') || lower.endsWith('.sample') || lower.includes('template');
}

function scanEnvLine(line, filePath, lineNo, findings) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) return;

  const key = m[1];
  const rawValue = m[2].replace(/^['"]|['"]$/g, '');

  const sensitiveKeys = [
    'MONGODB_URI',
    'DATABASE_URL',
    'JWT_SECRET',
    'SENDGRID_API_KEY',
    'R2_SECRET_ACCESS_KEY',
    'AWS_SECRET_ACCESS_KEY',
    'PAYMONGO_SECRET_KEY',
    'VITE_EMAILJS_PRIVATE_KEY',
    'SECRET_SCANNER_API_TOKEN'
  ];

  if (isExampleFile(filePath)) {
    return;
  }

  if (sensitiveKeys.includes(key) && !isPlaceholder(rawValue)) {
    findings.push(`${filePath}:${lineNo} -> ${key} looks like a real secret`);
  }

  if (key === 'MONGODB_URI' && /mongodb\+srv:\/\/[^\s:@]+:[^\s@]+@/i.test(rawValue)) {
    findings.push(`${filePath}:${lineNo} -> MONGODB_URI includes embedded credentials`);
  }
}

function scanText(filePath, content, findings) {
  const lines = content.split(/\r?\n/);

  const regexRules = [
    {
      name: 'MongoDB URI with creds',
      re: /mongodb\+srv:\/\/[^\s:'"@]+:[^\s'"@]+@[^\s'"/]+/i,
    },
    {
      name: 'Stripe secret key',
      re: /\bsk_(live|test)_[A-Za-z0-9]{16,}\b/,
    },
    {
      name: 'Private key block',
      re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    },
    {
      name: 'AWS access key id',
      re: /\bAKIA[0-9A-Z]{16}\b/,
    },
  ];

  for (let i = 0; i < lines.length; i += 1) {
    const lineNo = i + 1;
    const line = lines[i];

    // Ignore obvious comments/examples lines
    if (/^\s*[#/]{1,2}/.test(line)) {
      continue;
    }

    if (/\.env(\.|$)/i.test(filePath)) {
      scanEnvLine(line, filePath, lineNo, findings);
    }

    for (const rule of regexRules) {
      if (rule.re.test(line)) {
        const isExample = /<[^>]+>|username:password|user:pass|example|placeholder|your_/i.test(line);
        if (!isExample) {
          findings.push(`${filePath}:${lineNo} -> ${rule.name}`);
        }
      }
    }
  }
}

function main() {
  const files = getFiles();
  const findings = [];

  for (const file of files) {
    if (!isLikelyText(file)) continue;
    if (!fs.existsSync(file)) continue;

    const content = fs.readFileSync(file, 'utf8');

    // Skip minified/generated chunks
    if (file.includes('/dist/') || file.includes('\\dist\\')) continue;

    scanText(file, content, findings);
  }

  if (findings.length > 0) {
    console.error('\n❌ Potential secrets detected. Push/commit blocked.\n');
    findings.forEach((f) => console.error(` - ${f}`));
    console.error('\nFix by moving secrets to local .env files or secret managers, then retry.\n');
    process.exit(1);
  }

  console.log('✅ Secret scan passed');
}

main();
