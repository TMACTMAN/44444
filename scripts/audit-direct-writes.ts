import * as fs from 'fs';
import * as path from 'path';

const ALLOWED_FILES = [
  'src/engine/recorder/recorder.ts',
  'src/engine/recorder/cachePublisher.ts',
  'src/engine/world/worldCacheLoader.ts',
  'src/engine/world/worldBootstrap.ts',
  'src/engine/worldState.ts',
];

const FORBIDDEN_PATTERNS = [
  /globalWorld\.characters\.(set|delete|clear)/,
  /globalWorld\.locations\.(set|delete|clear)/,
  /globalWorld\.organizations\.(set|delete|clear)/,
  /globalWorld\.seeds\.(set|delete|clear)/,
  /globalWorld\.hiddenTruths\.(set|delete|clear)/,
  /globalWorld\.events\.(push|unshift|splice|pop|shift)/,
  /globalWorld\.snapshot(\.[a-zA-Z0-9_]+)?\s*=/,
  /globalWorld\.[a-zA-Z0-9_]+\.get\(.+?\)(\.[a-zA-Z0-9_]+)*\.resources\./,
  /globalWorld\.[a-zA-Z0-9_]+\.get\(.+?\)(\.[a-zA-Z0-9_]+)*\.attributes\./,
  /globalWorld\.[a-zA-Z0-9_]+\.get\(.+?\)(\.[a-zA-Z0-9_]+)*\.relationships\.(push|unshift|splice)/,
  /globalWorld\.[a-zA-Z0-9_]+\.get\(.+?\)(\.[a-zA-Z0-9_]+)*\.connected_to\.(push|unshift|splice)/,
  /globalWorld\.[a-zA-Z0-9_]+\.get\(.+?\)(\.[a-zA-Z0-9_]+)*\.evidence_collected\.(push|unshift|splice)/,
  /globalWorld\.[a-zA-Z0-9_]+\.get\(.+?\)(\.[a-zA-Z0-9_]+)*\.progress\s*(\+|\-|\*|\/)?=/,
  /globalWorld\.[a-zA-Z0-9_]+\.get\(.+?\)(\.[a-zA-Z0-9_]+)*\.status\s*=/,
  /WorldRepository\.saveCharacter/,
  /WorldRepository\.saveLocation/,
  /WorldRepository\.saveOrganization/,
  /WorldRepository\.saveSeed/,
  /WorldRepository\.saveHiddenTruth/,
  /WorldRepository\.saveWorldSnapshot/,
];

function scanFile(filePath: string, violations: string[]) {
  const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');

  if (ALLOWED_FILES.includes(relativePath) || relativePath.startsWith('tests/') || relativePath.includes('.test.') || relativePath.includes('.spec.')) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  if (content.includes('// audit-direct-write: allow-file')) {
    return;
  }

  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('// audit-direct-write: allow')) {
      continue;
    }
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(line)) {
        violations.push(`${relativePath}:${i + 1}: Found direct write pattern [${pattern.source}] -> "${line.trim()}"`);
      }
    }
  }
}

function scanDirectory(dir: string, violations: string[]) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
        scanDirectory(fullPath, violations);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      scanFile(fullPath, violations);
    }
  }
}

function main() {
  console.log('🔍 Running Audit: Direct Write Scan...');
  const violations: string[] = [];

  const srcDir = path.join(process.cwd(), 'src');
  if (fs.existsSync(srcDir)) {
    scanDirectory(srcDir, violations);
  }

  const serverTs = path.join(process.cwd(), 'server.ts');
  if (fs.existsSync(serverTs)) {
    scanFile(serverTs, violations);
  }

  if (violations.length > 0) {
    console.error(`❌ FOUND ${violations.length} DIRECT WRITE VIOLATIONS:`);
    for (const v of violations) {
      console.error(`  - ${v}`);
    }
    process.exit(1);
  } else {
    console.log('✅ Audit Passed: No direct writes found outside authorized Recorder modules!');
    process.exit(0);
  }
}

main();
