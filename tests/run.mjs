// 전체 회귀 테스트 실행기. 사용법: node run.mjs [스위트 이름...]
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ROOT } from './lib.mjs';

const ALL = ['auth', 'net', 'world', 'seats', 'nature', 'cats', 'housing', 'cafe', 'daynight', 'chat', 'board', 'lighting', 'piano', 'color', 'emote', 'inventory', 'roomcats', 'kyakya', 'theater', 'jazz', 'darts', 'pixel', 'furniture', 'cinema', 'economy', 'christmas', 'windows', 'tv', 'ui', 'mobile', 'record', 'homedeco', 'games', 'mates', 'expand', 'arcade', 'social', 'casino', 'exterior', 'reconnect', 'share', 'focus', 'farm', 'garden', 'resize', 'core', 'loading', 'catfurniture', 'petname', 'relogin'];
const selected = process.argv.slice(2).length ? process.argv.slice(2) : ALL;

const JOBS = Number(process.env.TEST_JOBS) || 6;
const SUITE_LIMIT_SEC = Number(process.env.TEST_SUITE_LIMIT_SEC) || 300;

let passed = 0;
const failures = [];

function reporter(suite) {
  return {
    passed: 0,
    failed: 0,
    check(name, ok, detail = '') {
      if (ok) {
        passed++;
        this.passed++;
        if (process.env.TEST_TRACE) console.log(`ok    [${suite}] ${name}`);   // 멈춘 스위트가 어디까지 했는지 볼 때
        return;
      }
      this.failed++;
      const line = `[${suite}] ${name}${detail !== '' ? '  -> ' + detail : ''}`;
      failures.push(line);
      console.log('FAIL  ' + line);
    },
  };
}

function checkCrypto() {
  const t = reporter('crypto');
  const binary = path.join(mkdtempSync(path.join(tmpdir(), 'mmo-crypto-')), 'crypto_check');
  execFileSync('c++', ['-std=c++17', '-O2', '-o', binary, path.join(ROOT, 'tests', 'crypto_check.cpp')]);
  const cases = [
    ['password', 'salt', 1],
    ['password', 'salt', 2],
    ['password', 'salt', 4096],
    ['', 'salt', 10],
    ['비밀번호 with spaces', '소금', 1000],
    ['x'.repeat(64), 'salt', 50],
    ['y'.repeat(65), 'salt', 50],
    ['z'.repeat(128), 'a'.repeat(100), 50],
  ];
  for (const [password, salt, iterations] of cases) {
    const expected = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('hex');
    const actual = execFileSync(binary, [Buffer.from(password).toString('hex'), Buffer.from(salt).toString('hex'), String(iterations)]).toString().trim();
    t.check(`PBKDF2 matches Node for pw(${password.length}) iter ${iterations}`, actual === expected, `${actual} vs ${expected}`);
  }
}

console.log('building server...');
execFileSync('make', ['-s'], { cwd: path.join(ROOT, 'server'), stdio: 'inherit' });

const started = Date.now();
checkCrypto();

async function runSuite(name) {
  const t = reporter(name);
  const suiteStart = Date.now();
  const { default: run } = await import(`./suites/${name}.mjs`);
  // 어떤 호출이 끝없이 기다리면 전체 실행이 멈추므로, 스위트마다 시간 제한을 둔다.
  // 제한에 걸리면 실패로 적고 다음 스위트로 넘어간다 (남은 서버는 끝날 때 정리된다).
  let timer;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${SUITE_LIMIT_SEC}s`)), SUITE_LIMIT_SEC * 1000);
  });
  try {
    await Promise.race([run(t), limit]);
  } catch (err) {
    t.failed++;
    failures.push(`[${name}] crashed: ${err.stack}`);
    console.log(`FAIL  [${name}] crashed: ${err.stack}`);
  } finally {
    clearTimeout(timer);
  }
  console.log(`${name.padEnd(10)} ${t.passed} passed, ${t.failed} failed (${((Date.now() - suiteStart) / 1000).toFixed(0)}s)`);
}

// 스위트마다 서버와 포트를 따로 쓰므로 동시에 돌릴 수 있다.
const queue = [...selected];
await Promise.all(Array.from({ length: Math.min(JOBS, queue.length) }, async () => {
  while (queue.length) await runSuite(queue.shift());
}));

console.log(`\n${failures.length ? 'FAILED' : 'ALL PASSED'}: ${passed} passed, ${failures.length} failed in ${((Date.now() - started) / 1000).toFixed(0)}s`);
process.exit(failures.length ? 1 : 0);
