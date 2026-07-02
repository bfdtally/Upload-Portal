# Dropdesk

A polished file drop-off portal prototype. Visitors can add their contact details, drag in files, leave a note, and receive an on-screen delivery receipt. The admin view organizes submissions with search, status filters, storage totals, and file downloads.

## Run locally

Serve this folder with any static web server, for example:

```bash
python3 -m http.server 4173
```

Then visit `http://localhost:4173`.

## Prototype storage

This first version stores submission metadata in `localStorage` and file contents in IndexedDB. That makes the complete experience testable without accounts or infrastructure, but data is limited to the browser and device where it was uploaded.

For a public launch, connect the form to a backend and cloud object storage (for example Supabase Storage, Amazon S3, or Cloudflare R2), then protect the admin view with authentication. The current UI and workflow can remain in place.
