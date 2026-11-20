# Alankrita Portfolio — public website + visual studio + Pages CMS

**Public portfolio:** https://alansri08.github.io/alankrita-portfolio/  
**Visual studio:** https://alansri08.github.io/alankrita-portfolio/studio.html  
**Content dashboard:** https://app.pagescms.org/  
**Repository:** https://github.com/alansri08/alankrita-portfolio

## Keep editing after the first launch

### Visual editor (drag, resize, images, shapes, Canva graphics)

1. Open **Visual studio** above. The public homepage has **no editor controls**.
2. Unlock with a **fine-grained GitHub personal access token** restricted to owner `alansri08`, repository `alankrita-portfolio`, permission **Contents: Read and write**. Create it at https://github.com/settings/personal-access-tokens/new . **Do not send it to ChatGPT or paste it into Canva.**
3. Add text, shapes, images (PNG/JPG/WebP/GIF/SVG), or a Canva embed; drag anything on the page; drag the green corner handle to resize it.
4. Click an item to change its font size, colors, rotation, position, opacity, link and more. You can also select existing page elements, move and resize them, and edit leaf text.
5. Switch between **Desktop** and **Mobile** to tune separate positions.
6. Use **Undo/Redo**, **Save draft**, or **Version history** to load an older published version for review.
7. Click **Publish to website**. Visual studio creates one Git commit containing your updated content, visual layout, and uploaded images. GitHub Pages automatically publishes changes from `main`. The previous version remains in Git history.

The token is kept **in browser memory for this tab only**, not in local storage or GitHub files. Browser drafts *are* saved to local storage, including unpublished images; this is device-specific and subject to browser storage limits. Publishing works only for the authenticated GitHub owner. Anyone can load the studio login page, but they cannot make repository changes without the authorized token; the **editor URL itself is not private hosting**.

### Pages CMS — quick routine content editing

1. Sign in at https://app.pagescms.org/ with GitHub and **install the official Pages CMS GitHub App** on `alansri08/alankrita-portfolio`.
2. Choose this repository and open **Portfolio content**. The `.pages.yml` file describes editable copy, contact links, fonts, colors, videos and project cards.
3. Save a change. Pages CMS writes `data.json` to the selected repository branch. **If that branch is `main`, the change goes live automatically.** Use Visual studio for draft preview before publishing.

Pages CMS is an optional convenience, not a dependency for visual editing. Its GitHub authorization is separate from the Visual studio token.

### Canva — two supported routes

**Versioned graphic (recommended):** Design in Canva → export PNG, JPG, WebP or SVG → open Visual studio → **Add image / graphic** or **Replace selected image** → drag, resize, preview → **Publish to website**. This puts the graphic into your Git repository and makes Git rollback possible. Store the Canva edit link in the selected image's **Canva design edit URL** field to return to the design later.

**Live Canva embed (optional):** In Canva, publish/share a *public embeddable design*, then copy the Canva embed URL. Click **Live Canva embed** in Visual studio and publish it. Future Canva design updates may appear on the website automatically **without** a new GitHub publish; those updates cannot be rolled back using GitHub history. Only use this when that behavior is intended. The design must permit public embedding.

There is **no automatic two-way conversion of arbitrary HTML elements into Canva layers or vice versa**. Canva edits to an entire page cannot reliably replace native HTML/JS on GitHub Pages without export/conversion.

## Reliability and security

- **Public HTML:** `index.html`, `visual-runtime.js`. They never ask for or store GitHub tokens.
- **Site data:** `data.json` (content), `visual.json` (custom text, images, shapes, Canva embeds, and per-device element placements).
- **Visual editor:** `studio.html`, `studio.css`, `studio.js` (not linked from public site).
- **Publishing:** Studio uses GitHub's Git Trees/Commits/Refs APIs to write image assets + both JSON files as **one commit**, preventing partial published changes. If another edit was published after you opened Studio, it refuses to overwrite it; save your local draft and review the latest version before publishing.
- **Undo:** Undo/Redo covers draft edits; **Version history** loads previous Git commits as drafts so they can be previewed and republished.
- **GitHub Pages:** Repo Settings → Pages must point to `main` / `(root)` (existing deployment). Pages may take several minutes to reflect a new commit.
- **Public editors:** This Studio page is *publicly retrievable* because it is on GitHub Pages, but its functionality requires a write-authorized GitHub token. For genuinely private access to the editor's source/page, move Studio to private hosting with server-side authentication.
- **Do not use a broad personal access token** and do not store credentials in a repository, Canva design, screenshot, or chat message.

## Current limitations

- The visual editor is custom-built, so the first publish should be tested with a small noncritical change.
- Freeform positioning can overlap other elements; check both Desktop and Mobile previews.
- Very large files may exceed browser local-draft quotas. Raster uploads are resized/compressed to WebP; GIFs above 1.1 MB are flattened to a WebP frame.
- Restoring an older version only changes the content/layout files; other repository code stays current.
- Pages CMS changes to main bypass Studio preview. Do not edit simultaneously in both tools without reloading Studio.
- Embedded Canva changes bypass the GitHub approval/rollback workflow. Exported static Canva graphics do not.
