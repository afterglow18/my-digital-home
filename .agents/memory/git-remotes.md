---
name: Git remotes
description: Which GitHub remotes exist and which to push to for My Digital Home
---

Only push to the `home` remote: `github.com/afterglow18/my-digital-home`.

`origin` was removed — it pointed to `my-digital-handbags`, which is a **separate app** and must never receive My Digital Home commits.

`vanity` points to `my-digital-vanity` — another separate app; do not push there either.

**Why:** Pushing to handbags or vanity would overwrite unrelated apps with My Digital Home code.

**How to apply:** All git pushes must use `git push home main` only.
