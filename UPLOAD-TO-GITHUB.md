# Manual upload

1. Extract the source ZIP.
2. Create an empty private repository named offload-observer in your GitHub account.
3. Upload the extracted folder's contents, including .gitignore and .gitattributes.
   README.md, Makefile, root/, tests/ and docs/ should sit at the repository root,
   rather than inside an extra offload-observer folder.
4. Commit the uploaded files with a message such as:
   Preserve Offload Observer 0.2.4 prototype and continuation notes.

For future work, start with docs/STATUS.md, then DEVELOPMENT.md. The first describes
the CPU improvement, unresolved accounting discrepancy, unverified breakdowns and
the exact limits of what was tested.

No router captures, country database, credentials, dependency cache, Git history
or generated screenshots are included. This source ZIP is for storing and editing
the project, not directly installing on the router. Build deployment archives with
python scripts/build.py when needed.
