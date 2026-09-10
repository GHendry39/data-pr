#!/usr/bin/env node
/**
 * Patches aws-cdk-lib's NodejsFunction bundling to fix a Windows-specific bug
 * where esbuild arguments are passed through PowerShell, causing the
 * --banner:js content (Amplify's SSM resolver) to be mangled by shell
 * quote handling.
 *
 * The fix replaces the PowerShell-based spawn path. For .cmd wrappers
 * (e.g. "npx.cmd --no-install esbuild --bundle ..."), it:
 *  1. Finds the bin name = first non-flag arg in the args array ("esbuild")
 *  2. Resolves the real bin script via createRequire(__filename) from the
 *     bundling.js location, giving the absolute path to esbuild/bin/esbuild
 *  3. Runs it as "node <path> <remaining-args>" — no shell, no quoting issues
 *
 * Related: CVE-2026-11417, unfixed through aws-cdk-lib 2.266.0 on Windows.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const bundlingPath = resolve(
  require.resolve('aws-cdk-lib/package.json'),
  '../aws-lambda-nodejs/lib/bundling.js'
);

// The original PowerShell-based spawn from aws-cdk-lib
const ORIGINAL = `case"spawn":isWindows?(0,util_1().exec)("powershell.exe",["-NoProfile","-Command",\`& \${step.command.map(powershellEscape).join(" ")}\`],{...execOptions,cwd:step.cwd??cwd}):(0,util_1().exec)(step.command[0],step.command.slice(1),{...execOptions,cwd:step.cwd??cwd});break`;

// The patched version:
// - Finds bin name as first non-flag arg (e.g. "esbuild" in ["--no-install","esbuild","--bundle",...])
// - Resolves it to its actual bin script using createRequire(__filename)
// - Runs "node <binPath> <args-after-binName>" directly, bypassing any shell
const PATCHED = `case"spawn":{let sc=step.command[0];let sa=step.command.slice(1);if(isWindows&&sc.endsWith(".cmd")){const binName=sa.find(a=>!a.startsWith("-"));if(binName){try{const pkgJson=require("module").createRequire(__filename).resolve(binName+"/package.json");const binPath=require("path").join(require("path").dirname(pkgJson),"bin",binName);if(require("fs").existsSync(binPath)){const binArgIdx=sa.indexOf(binName);sc="node";sa=[binPath,...sa.slice(binArgIdx+1)];}}catch(e){}}}(0,util_1().exec)(sc,sa,{...execOptions,cwd:step.cwd??cwd});break}`;

let content = readFileSync(bundlingPath, 'utf8');

if (content.includes(PATCHED) && !content.includes(ORIGINAL)) {
  console.log('patch-cdk-bundling: already applied, skipping.');
  process.exit(0);
}

if (!content.includes(ORIGINAL)) {
  console.warn(
    'patch-cdk-bundling: expected pattern not found — aws-cdk-lib may have been updated. ' +
    'Check whether this patch is still needed.'
  );
  process.exit(0);
}

content = content.replace(ORIGINAL, PATCHED);
writeFileSync(bundlingPath, content, 'utf8');
console.log('patch-cdk-bundling: patched aws-cdk-lib NodejsFunction Windows spawn path.');
