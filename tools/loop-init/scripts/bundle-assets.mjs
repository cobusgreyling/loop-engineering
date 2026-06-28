#!/usr/bin/env node
import { cp, rm, access, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '../..');
const LOCK_DIR = path.join(PACKAGE_ROOT, '.bundle-assets.lock');

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function replaceDirectory(src, dest) {
  const tempDest = `${dest}.tmp-${process.pid}-${Date.now()}`;
  let moved = false;
  await rm(tempDest, { recursive: true, force: true });
  try {
    await cp(src, tempDest, { recursive: true });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await rm(dest, { recursive: true, force: true });
      try {
        await rename(tempDest, dest);
        moved = true;
        return;
      } catch (err) {
        if (err?.code !== 'EEXIST' || attempt === 2) {
          throw err;
        }
      }
    }
  } finally {
    if (!moved) {
      await rm(tempDest, { recursive: true, force: true });
    }
  }
}

async function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function acquireLock() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await mkdir(LOCK_DIR);
      return async () => rm(LOCK_DIR, { recursive: true, force: true });
    } catch (err) {
      if (err?.code !== 'EEXIST') {
        throw err;
      }
      await sleep(50);
    }
  }
  throw new Error(`bundle-assets: timed out waiting for ${LOCK_DIR}`);
}

const releaseLock = await acquireLock();
try {
  for (const dir of ['starters', 'templates']) {
    const dest = path.join(PACKAGE_ROOT, dir);
    const src = path.join(REPO_ROOT, dir);
    if (!(await exists(src))) {
      throw new Error(`bundle-assets: missing ${src}`);
    }
    await replaceDirectory(src, dest);
    console.log(`bundled ${dir}/ → tools/loop-init/${dir}/`);
  }

  const registrySrc = path.join(REPO_ROOT, 'patterns', 'registry.yaml');
  const registryDest = path.join(PACKAGE_ROOT, 'registry.yaml');
  if (await exists(registrySrc)) {
    await cp(registrySrc, registryDest);
    console.log('bundled patterns/registry.yaml → tools/loop-init/registry.yaml');
  }
} finally {
  await releaseLock();
}
