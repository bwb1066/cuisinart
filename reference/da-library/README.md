# DA Library Setup — aem-* Blocks (bwb1066/cuisinart)

## Steps

1. In da.live, open the existing library folder at `docs/library/blocks`
   (the Author Kit starter's block samples already live there).
2. For each `aem-*.html` file here: create a doc with that exact name in that
   folder, open the HTML file in a browser, select everything below the marker
   line, copy, paste into the doc.
3. Open the blocks sheet at `docs/library/blocks` (or wherever the site
   config's `library` tab points) and append the rows from
   `blocks-sheet.csv` (`name` and `path` columns).
4. Reload the DA editor — the aem-* blocks appear in the Blocks panel.

## Caveats

- **aem-form** needs a form-definition JSON; **aem-widget** (if ported) needs
  files under `/widgets/` in the code repo; **aem-search** needs a published
  query index; **aem-modal** is link-triggered (`/modals/...`), not a table.
- **aem-header / aem-footer** are page chrome, not picker blocks — activate per
  page via `aem-header` / `aem-footer` metadata pointing at `nav` /
  `footer` docs.
- Sample images reference the Author Kit starter demo image on the preview
  host — swap for real assets.
