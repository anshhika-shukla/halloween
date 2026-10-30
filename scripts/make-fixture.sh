#!/usr/bin/env bash
# scripts/make-fixture.sh - builds fixtures/haunted-todo (deterministic, 8 commits)
set -euo pipefail
ROOT="${FIXTURE_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
DIR="$ROOT/fixtures/haunted-todo"
rm -rf "$DIR" && mkdir -p "$DIR/src" "$DIR/test" "$DIR/docs" && cd "$DIR"
git init -q -b main
export GIT_AUTHOR_NAME="Ada Hollow" GIT_AUTHOR_EMAIL="ada@example.invalid"
export GIT_COMMITTER_NAME="Ada Hollow" GIT_COMMITTER_EMAIL="ada@example.invalid"
c() { # usage: c "message" "ISO date"
  git add -A
  GIT_AUTHOR_DATE="$2" GIT_COMMITTER_DATE="$2" git commit -q -m "$1"
}

# --- commit 1 ---
cat > package.json <<'EOF'
{"name":"haunted-todo","version":"0.1.0","main":"src/todo.js",
 "scripts":{"test":"node --test"},"license":"MIT"}
EOF
printf '# haunted-todo\n\nA tiny todo-list library. Zero dependencies.\n' > README.md
cat > src/todo.js <<'EOF'
'use strict';
function addTodo(list, text) {
  const id = list.length + 1;
  return [...list, { id, text, done: false }];
}
function listTodos(list) {
  return list.map((t) => `${t.id}. ${t.text}`);
}
module.exports = { addTodo, listTodos };
EOF
c "Initial commit: todo list core" "2021-03-02T10:00:00+00:00"

# --- commit 2 ---
cat > src/storage.js <<'EOF'
'use strict';
const fs = require('node:fs');
// Design note: todos live in a flat JSON file (see docs/DESIGN.md).
function load(file) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function save(file, list) {
  fs.writeFileSync(file, JSON.stringify(list, null, 2));
}
module.exports = { load, save };
EOF
cat > docs/DESIGN.md <<'EOF'
# Design notes

## Why a JSON file instead of SQLite?
We chose a flat JSON file for storage so the library keeps zero dependencies.
SQLite would add a native build step that broke on two of our CI machines.
Trade-off: no concurrent writers. Revisit if the project grows.
EOF
c "Add JSON file storage (no sqlite, keep zero dependencies)" "2021-03-09T10:00:00+00:00"

# --- commit 3 ---
cat > src/todo.js <<'EOF'
'use strict';
function addTodo(list, text) {
  const id = list.length + 1;
  return [...list, { id, text, done: false }];
}
function completeTodo(list, id) {
  return list.map((t) => (t.id === id ? { ...t, done: true } : t));
}
function listTodos(list) {
  return list.map((t) => `${t.id}. ${t.text}`);
}
module.exports = { addTodo, completeTodo, listTodos };
EOF
cat > test/todo.test.js <<'EOF'
const test = require('node:test');
const assert = require('node:assert');
const { addTodo, completeTodo } = require('../src/todo');

test('addTodo appends an item', () => {
  const list = addTodo([], 'buy milk');
  assert.strictEqual(list.length, 1);
});

test('completeTodo marks item done', () => {
  const list = completeTodo(addTodo([], 'x'), 1);
  assert.strictEqual(list[0].done, true);
});
EOF
c "Add completeTodo and first tests" "2021-04-14T10:00:00+00:00"

# --- commit 4 ---
printf '\n## Usage\n\n' >> README.md
printf '    const { addTodo } = require("haunted-todo");\n' >> README.md
printf '    let list = addTodo([], "write docs");\n' >> README.md
c "Add README usage section" "2021-06-01T10:00:00+00:00"

# --- commit 5 (introduces the bug: assignment instead of comparison) ---
cat > src/todo.js <<'EOF'
'use strict';
function addTodo(list, text) {
  const id = list.length + 1;
  return [...list, { id, text, done: false }];
}
function completeTodo(list, id) {
  return list.map((t) => (t.id === id ? { ...t, done: true } : t));
}
function listTodos(list) {
  return list.map((t) => `${t.id}. ${t.text}`);
}
// Count todos that are not finished yet.
function pendingCount(list) {
  return list.filter((t) => (t.done = false)).length;
}
module.exports = { addTodo, completeTodo, listTodos, pendingCount };
EOF
c "Add pendingCount helper" "2021-09-18T10:00:00+00:00"

# --- commit 6 ---
echo "// TODO: dedupe ids when two lists are merged" >> src/storage.js
echo "// FIXME: concurrent writes can corrupt the file" >> src/storage.js
c "Note: ids need deduping (TODO), storage races (FIXME)" "2021-11-02T10:00:00+00:00"

# --- commit 7 (failing test, never run) ---
cat >> test/todo.test.js <<'EOF'

const { pendingCount } = require('../src/todo');
test('pendingCount ignores finished items', () => {
  const list = [{ id: 1, done: false }, { id: 2, done: true }, { id: 3, done: false }];
  assert.strictEqual(pendingCount(list), 2);
});
EOF
c "Add pendingCount test (wip, did not run)" "2022-01-15T10:00:00+00:00"

# --- commit 8 ---
printf '\n> Maintenance paused. Sorry!\n' >> README.md
c "Last commit before life got busy" "2022-02-20T10:00:00+00:00"
echo "fixture ready: $DIR"
