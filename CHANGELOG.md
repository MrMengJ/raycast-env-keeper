# Env Keeper Changelog

## [Initial Version] - {PR_MERGE_DATE}

First release.

**Projects**

- Register projects by hand, rename them, sorted by most recently used; re-point a project whose directory moved and keep its settings
- Create, edit and delete variables with single-line / multi-line values, all three quoting styles, the `export` prefix and inline comments (parsing rules compared case by case against dotenv); values containing newlines, `#` or surrounding whitespace are quoted automatically and read back unchanged
- Enable / disable = comment the line out, following dotenv convention; when a variable appears twice, each line is handled on its own and marked as a duplicate
- Secrets are detected automatically (keywords in the name, plus connection strings with credentials detected by value) and can be marked / unmarked per project; masked in lists, revealed with one shortcut; copying a value keeps it out of clipboard history
- Multiple environments: any name (including multi-part names like `.env.development.local`), one file per environment; only real env files are listed — `.envrc` and the like never appear; copy the current environment to `.env` (confirmation before overwrite)
- A snapshot before every write (stored by project id, so same-named projects never mix); view diffs, roll back, clean up in bulk; an emptied file still enters history
- `.env.example` generated as a merge: hand-written notes in the template are kept, only keys are added or removed
- Profiles: several parallel sets of `.env` content kept inside the extension (no files written into the project), applied as a whole at any time; save from the current file, start blank, or duplicate one; diff summary before applying, a notice if the file was edited by hand afterwards; grouping (filter and search by group, rename or dissolve a whole group); history
- A new empty env file can borrow the structure of an existing one (without values) or copy it entirely
- Recognizes dotenvx's `encrypted:` prefix and blocks accidental edits; a detected `.envrc` only produces a notice, nothing is touched

**Shell**

- Create, edit, delete and enable / disable environment variables, aliases and script snippets; reorder them; grouping (a section per group, toggle / rename / dissolve a whole group); the type is shown as an icon
- When two enabled snippets set the same variable or alias, a duplicate notice explains which one wins (nothing is blocked); multiple assignments on one line and `alias -g` are recognized; local variables inside function bodies don't count
- After a change, a hint says it applies to new terminals; "Copy Refresh Command" brings additions and edits into terminals already open, and explains why disabling / deleting can't be refreshed that way
- Add or remove the `source` line in `.zshrc` with one action (guarded by a file-exists check, uses `$HOME`; the real login shell is detected and a backup is taken before any change; only the line written by the extension is removed, everything else stays)
- Syntax validation with the real shell (`zsh -n` / `bash -n`); skipped without blocking when the shell isn't recognized
- Spelling hint: things like `exprot` are valid syntax that will never take effect — you are asked before saving
- Preview the generated `shell.sh`, with snippet contents masked by default
- Full config history with rollback; view the history of a single snippet
- `.zshrc` backup list: automatic backups are visible and restorable; manual backups go to the default directory or a location of your choice

**Global**

- `Jump to` command: open a project / env file / profile / shell snippet by name (group, note and type words are all searchable); snippets can be toggled in place
- Variable search across projects, profiles and the shell config, by name or by value; the jump lands directly on the matched item; shell values overridden by a same-named snippet are marked
- Consistent shortcuts: ⌘T toggle, ⌘⇧M reveal, ⌘⇧H snapshot history, ⌘N new; Enter is always a harmless action
- When the login shell is neither zsh nor bash, the Shell section says so plainly
- Interface in English or Simplified Chinese
- If a config file is corrupted or unreadable, the original is preserved and a clear error is shown; writes are refused until it's fixed — it is never silently emptied

**Security & privacy**

- The data directory and the files created in it are private to you (directory 700, files 600), `shell.sh` included; files you loosened with chmod yourself are left alone
- Snapshots inherit the source file's permissions: a 600 `.env` gets 600 history copies (previously 644 — and those copies contain keys you deleted long ago)
- Newlines slipped into a snippet's name / group / note are stripped — they would split the comment line into a command executed on every new terminal
- Before writing, the whole generated script is syntax-checked with your real shell; if the assembled file doesn't parse, nothing is written (previously only single snippets were checked)
- Temp files for atomic writes now start with `.env` (caught by `.env*` ignore rules) and carry no timestamp (a leftover from a crash is overwritten by the next write of the same file); a normal write leaves nothing behind
- Masking now covers auth values like `Authorization: Bearer …`; the "whole snippet is secret" flag also applies in the `shell.sh` preview, which says so when it differs from what's on disk
- Quoted assignments spanning lines (like `export API_KEY="first line` continuing on the next) were previously not masked at all; the whole value is now hidden
- Env files that are symlinks are listed and read / written normally (the target is written, the link itself is untouched); when the name is taken by a directory you get a plain message instead of a system error
