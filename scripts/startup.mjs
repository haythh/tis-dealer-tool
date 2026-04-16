#!/usr/bin/env node
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('[startup] Running data import...');
execSync(`node ${path.join(__dirname, 'import-data.mjs')}`, { stdio: 'inherit' });

console.log('[startup] Running stock import...');
execSync(`node ${path.join(__dirname, 'import-stock.mjs')}`, { stdio: 'inherit' });

console.log('[startup] Starting Next.js...');
execSync('npx next start', { stdio: 'inherit' });
