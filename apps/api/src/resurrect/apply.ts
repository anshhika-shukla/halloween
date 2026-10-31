// apps/api/src/resurrect/apply.ts - Approve and reject actions for proposed patches
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { AppError } from '../errors.js';
import { getWorkspaceRoot } from '../ingest/sourceValidator.js';
import { findPatchById, getRepoCloneDir } from './propose.js';
import type { Patch } from '../types.js';

export async function approvePatch(
  patchId: string,
  options?: { workspaceRoot?: string }
): Promise<Patch> {
  const workspaceRoot = options?.workspaceRoot || getWorkspaceRoot();
  const patchRecord = findPatchById(patchId, workspaceRoot);

  if (!patchRecord) {
    throw new AppError('patch_not_found', `Patch ${patchId} not found`, 404);
  }

  const { patch, repoId, patchPath } = patchRecord;

  if (patch.state === 'approved') {
    throw new AppError('patch_already_approved', 'This patch has already been approved', 409);
  }

  if (patch.state === 'rejected') {
    throw new AppError('patch_already_rejected', 'This patch has already been rejected', 400);
  }

  const repoCloneDir = getRepoCloneDir(repoId, workspaceRoot);
  const branchName = `reporevenant/fix-${patch.findingId}`;

  try {
    // 1. Create or switch to branch
    execSync(`git checkout -B ${branchName}`, {
      cwd: repoCloneDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    // 2. Apply the patch
    execSync('git apply --ignore-whitespace -', {
      cwd: repoCloneDir,
      input: patch.diff,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    // 3. Stage and commit
    execSync('git add -A', {
      cwd: repoCloneDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    execSync(
      `git commit -m "reporevenant: fix ${patch.findingId}" -m "Resolves finding ${patch.findingId}"`,
      {
        cwd: repoCloneDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      }
    );

    // 4. Update patch record
    patch.state = 'approved';
    patch.branch = branchName;

    fs.writeFileSync(patchPath, JSON.stringify(patch, null, 2), 'utf8');

    return patch;
  } catch (err: any) {
    const stderr = err?.stderr?.toString() || err?.message || 'Failed to apply patch to repository';
    throw new AppError('patch_apply_failed', `Failed to apply patch: ${stderr}`, 500);
  }
}

export async function rejectPatch(
  patchId: string,
  options?: { workspaceRoot?: string }
): Promise<Patch> {
  const workspaceRoot = options?.workspaceRoot || getWorkspaceRoot();
  const patchRecord = findPatchById(patchId, workspaceRoot);

  if (!patchRecord) {
    throw new AppError('patch_not_found', `Patch ${patchId} not found`, 404);
  }

  const { patch, patchPath } = patchRecord;

  if (patch.state === 'approved') {
    throw new AppError('patch_already_approved', 'Cannot reject an already approved patch', 409);
  }

  patch.state = 'rejected';
  fs.writeFileSync(patchPath, JSON.stringify(patch, null, 2), 'utf8');

  return patch;
}
