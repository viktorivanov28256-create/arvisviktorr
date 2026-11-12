#!/usr/bin/env python3
"""GitHub runner only. Fetch verified inert blobs; publish one clean snapshot commit.

Never imports or runs captured files. No token is written to disk or printed.
"""
import base64
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.request

REPOSITORY = 'viktorivanov28256-create/arvisviktorr'
BRANCH = 'audit-snapshot'
PARENT = 'e2c2c363d147e4079bbc93e4ccc8b2862280e840'
MAX_FILE = 99 * 1024 * 1024
MAX_TOTAL = 3 * 1024 * 1024 * 1024
CHUNK_SIZE = 4 * 1024 * 1024
H = lambda b: hashlib.sha256(b).hexdigest()
G = lambda b: hashlib.sha1(b'blob ' + str(len(b)).encode() + b'\0' + b).hexdigest()


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def safe_name(name):
    require(isinstance(name, str) and name and '\\' not in name, 'UNSAFE_NAME')
    require(not any(ord(c) < 32 or ord(c) == 127 for c in name), 'CONTROL_IN_NAME')
    path = PurePosixPath(name)
    require(not path.is_absolute() and path.as_posix() == name, 'NONCANONICAL_NAME')
    require(all(p not in ('', '.', '..', '.git') for p in name.split('/')), 'UNSAFE_SEGMENT')
    require(not any(p in ('.gitmodules', '.gitattributes', '.lfsconfig') for p in name.split('/'))
            and not name.startswith('.github/'), 'EXECUTABLE_REPO_METADATA_FORBIDDEN')
    return name


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError('API_REDIRECT_REFUSED')


def fetch_blob(entry, token):
    sha = entry['git_blob_sha']
    require(re.fullmatch(r'[0-9a-f]{40}', sha) is not None, 'BAD_BLOB_SHA')
    require(type(entry['size']) is int and 0 < entry['size'] <= CHUNK_SIZE, 'BAD_CHUNK_SIZE')
    req = urllib.request.Request(
        f'https://api.github.com/repos/{REPOSITORY}/git/blobs/{sha}',
        headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json',
                 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'arvis-audit-materializer'})
    with urllib.request.build_opener(NoRedirect()).open(req, timeout=90) as response:
        require(response.status == 200, 'BLOB_HTTP_NOT_200')
        encoded = response.read(CHUNK_SIZE * 2 + 1)
    require(len(encoded) <= CHUNK_SIZE * 2, 'BLOB_RESPONSE_TOO_LARGE')
    obj = json.loads(encoded)
    require(obj.get('encoding') == 'base64' and obj.get('sha') == sha and obj.get('size') == entry['size'], 'BLOB_METADATA_MISMATCH')
    content = obj['content']
    require(isinstance(content, str), 'BLOB_CONTENT_NOT_STRING')
    raw = base64.b64decode(''.join(content.split()), validate=True)
    require(len(raw) == entry['size'] and G(raw) == sha and H(raw) == entry['sha256'], 'BLOB_BYTES_MISMATCH')
    return raw


def validate_and_extract(archive, target, manifest_sha, expected_count, expected_bytes):
    """Validate the entire archive and manifest before creating any payload files."""
    with tarfile.open(archive, 'r:gz') as tar:
        members = tar.getmembers()
        require(len(members) == expected_count and len(members) <= 50000, 'ARCHIVE_MEMBER_COUNT')
        names = [safe_name(m.name) for m in members]
        require(len(set(names)) == len(names), 'DUPLICATE_ARCHIVE_PATH')
        require(all(m.isreg() and 0 <= m.size <= MAX_FILE for m in members), 'ARCHIVE_NONREGULAR_OR_OVERSIZE')
        require(sum(m.size for m in members) == expected_bytes <= MAX_TOTAL, 'ARCHIVE_TOTAL_BYTES')
        lookup = dict(zip(names, members))
        require('file-manifest.json' in lookup and lookup['file-manifest.json'].size <= 16 * 1024 * 1024, 'MISSING_MANIFEST')
        manifest_raw = tar.extractfile(lookup['file-manifest.json']).read()
        require(H(manifest_raw) == manifest_sha, 'CLEAN_MANIFEST_SHA_MISMATCH')
        rows = json.loads(manifest_raw)['files']
        require(isinstance(rows, list) and len(rows) + 1 == len(members), 'MANIFEST_COUNT')
        expected = {}
        for row in rows:
            name = safe_name(row['path'])
            require(name != 'file-manifest.json' and name not in expected, 'DUPLICATE_MANIFEST_PATH')
            require(type(row['size']) is int and 0 <= row['size'] <= MAX_FILE, 'MANIFEST_SIZE')
            require(re.fullmatch(r'[0-9a-f]{64}', row['sha256']) is not None, 'MANIFEST_SHA256')
            require(re.fullmatch(r'[0-9a-f]{40}', row['git_blob_sha']) is not None, 'MANIFEST_GIT_SHA')
            expected[name] = row
        expected['file-manifest.json'] = {'size': len(manifest_raw), 'sha256': H(manifest_raw), 'git_blob_sha': G(manifest_raw)}
        require(set(expected) == set(lookup), 'ARCHIVE_WHITELIST_MISMATCH')
        # First pass validates every byte before extraction or Git staging.
        for name, row in expected.items():
            require(lookup[name].size == row['size'], 'MEMBER_SIZE_MISMATCH')
            raw = tar.extractfile(lookup[name]).read()
            require(len(raw) == row['size'] and H(raw) == row['sha256'] and G(raw) == row['git_blob_sha'], 'MEMBER_HASH_MISMATCH')
        # No tar.extract/extractall: construct each regular file ourselves.
        for name in sorted(expected):
            full = target / name
            full.parent.mkdir(parents=True, exist_ok=True)
            require(full.parent.resolve().is_relative_to(target.resolve()), 'EXTRACTION_ESCAPED')
            with full.open('xb') as out:
                source = tar.extractfile(lookup[name])
                while chunk := source.read(1024 * 1024):
                    out.write(chunk)
            full.chmod(0o644)
    return expected


def git(target, *args, env=None):
    return subprocess.run(['git', '-c', 'core.hooksPath=/dev/null', '-c', 'core.autocrlf=false', *args],
                          cwd=target, env=env, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout


def auth_env(token):
    env = {k: v for k, v in os.environ.items() if not k.startswith(('GIT_TRACE', 'GIT_CONFIG')) and k != 'GIT_CURL_VERBOSE'}
    auth = base64.b64encode(('x-access-token:' + token).encode()).decode()
    env.update(GIT_CONFIG_COUNT='1', GIT_CONFIG_KEY_0='http.https://github.com/.extraheader',
               GIT_CONFIG_VALUE_0='AUTHORIZATION: basic ' + auth, GIT_TERMINAL_PROMPT='0')
    return env


def main():
    require(len(sys.argv) == 3, 'USAGE_MANIFEST_TARGET')
    token = os.environ.get('GH_TOKEN', '')
    require(token and os.environ.get('GITHUB_REPOSITORY') == REPOSITORY, 'RUNNER_REPOSITORY_OR_TOKEN_MISSING')
    transfer = json.loads(Path(sys.argv[1]).read_bytes())
    require(transfer.get('schema') == 1 and transfer.get('repository') == REPOSITORY and transfer.get('branch') == BRANCH and transfer.get('expected_parent') == PARENT, 'TRANSFER_SCOPE_MISMATCH')
    require(transfer.get('clean_payload_scan_passed') is True, 'CLEAN_PAYLOAD_SCAN_NOT_APPROVED')
    chunks = transfer['chunks']
    require(0 < len(chunks) <= 400 and [c['index'] for c in chunks] == list(range(len(chunks))), 'CHUNK_ORDER_OR_COUNT')
    require(0 < transfer['archive_size'] <= 1024 * 1024 * 1024, 'ARCHIVE_SIZE_BOUND')
    require(sum(c['size'] for c in chunks) == transfer['archive_size'], 'CHUNK_TOTAL')
    require(re.fullmatch(r'[0-9a-f]{64}', transfer['archive_sha256']) is not None, 'ARCHIVE_SHA256')
    target = Path(sys.argv[2]).resolve()
    require((target / '.git').is_dir() and git(target, 'rev-parse', 'HEAD').decode().strip() == PARENT, 'TARGET_PARENT_MISMATCH')
    require(not git(target, 'status', '--porcelain', '--untracked-files=all'), 'TARGET_NOT_CLEAN')
    remote = f'https://github.com/{REPOSITORY}.git'
    env = auth_env(token)
    head = git(target, 'ls-remote', '--exit-code', remote, f'refs/heads/{BRANCH}', env=env).decode().split()[0]
    require(head == PARENT, 'REMOTE_BRANCH_CHANGED_STOP')
    with tempfile.TemporaryDirectory(prefix='arvis-audit-materialize-') as temporary:
        archive = Path(temporary) / 'payload.tar.gz'
        digest = hashlib.sha256()
        with archive.open('xb') as out:
            for entry in chunks:
                raw = fetch_blob(entry, token)
                out.write(raw)
                digest.update(raw)
        require(archive.stat().st_size == transfer['archive_size'] and digest.hexdigest() == transfer['archive_sha256'], 'ASSEMBLED_ARCHIVE_MISMATCH')
        extracted = Path(temporary) / 'clean'
        extracted.mkdir(mode=0o700)
        expected = validate_and_extract(archive, extracted, transfer['file_manifest_sha256'], transfer['member_count'], transfer['total_file_bytes'])
        git(target, 'rm', '-r', '-f', '--ignore-unmatch', '--', '.')
        # Move only already-validated inert regular files; no captured code is run.
        for name in sorted(expected):
            destination = target / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            require(destination.parent.resolve().is_relative_to(target), 'TARGET_PATH_ESCAPED')
            require(not destination.exists(), 'TARGET_FILE_COLLISION')
            with (extracted / name).open('rb') as source, destination.open('xb') as out:
                shutil.copyfileobj(source, out, 4 * 1024 * 1024)
            destination.chmod(0o644)
        git(target, 'add', '-f', '--', '.')
        actual = {}
        for record in git(target, 'ls-files', '--stage', '-z').split(b'\0'):
            if not record:
                continue
            metadata, path = record.split(b'\t', 1)
            mode, sha, stage = metadata.decode().split()
            require(mode == '100644' and stage == '0', 'INDEX_MODE_OR_STAGE')
            actual[path.decode('utf-8')] = sha
        require(actual == {name: row['git_blob_sha'] for name, row in expected.items()}, 'FINAL_GIT_INDEX_NOT_EXACT_MANIFEST')
        head = git(target, 'ls-remote', '--exit-code', remote, f'refs/heads/{BRANCH}', env=env).decode().split()[0]
        require(head == PARENT, 'REMOTE_BRANCH_CHANGED_BEFORE_COMMIT')
        git(target, 'config', 'user.name', 'github-actions[bot]')
        git(target, 'config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com')
        git(target, '-c', 'commit.gpgsign=false', 'commit', '-m', 'Publish verified public HTTP snapshot of arvisclinic.ru')
        commit = git(target, 'rev-parse', 'HEAD').decode().strip()
        require(git(target, 'rev-parse', 'HEAD^').decode().strip() == PARENT, 'NEW_COMMIT_PARENT_MISMATCH')
        # Normal fast-forward only. Concurrent branch changes cause rejection.
        git(target, 'push', remote, f'HEAD:refs/heads/{BRANCH}', env=env)
        observed = git(target, 'ls-remote', '--exit-code', remote, f'refs/heads/{BRANCH}', env=env).decode().split()[0]
        require(observed == commit, 'PUSH_READBACK_MISMATCH')
        print(json.dumps({'status': 'PUBLISHED_EXACT_CLEAN_SNAPSHOT', 'commit': commit,
                          'parent': PARENT, 'files': len(expected), 'archive_sha256': transfer['archive_sha256'],
                          'file_manifest_sha256': transfer['file_manifest_sha256']}))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        # Avoid dumping token-bearing environment, request headers, or subprocess output.
        detail = ':' + str(exc) if isinstance(exc, RuntimeError) else ''
        if isinstance(exc, subprocess.CalledProcessError):
            detail = ':returncode=' + str(exc.returncode)
        print('MATERIALIZE_STOP:' + type(exc).__name__ + detail, file=sys.stderr)
        raise SystemExit(1)
