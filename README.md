# DropDesk

A private client file-delivery portal backed by Supabase.

## Features

- Multiple file uploads to a private Supabase Storage bucket
- Submission metadata stored in Supabase Postgres
- Administrator login through Supabase Auth
- Searchable submission dashboard
- Secure in-app previews for images, PDFs, video, audio, and text files
- Dropbox Saver archiving from the Admin dashboard
- Private, time-limited file download links
- New/reviewed status tracking
- Responsive desktop and mobile design

## Deploy

This is a static site. Upload `index.html`, `styles.css`, and `app.js` to the root of a GitHub repository, then deploy with GitHub Pages or Render.

For Render, use:

- Build command: `echo "No build needed"`
- Publish directory: `.`

## Supabase

The publishable key in `app.js` is intentionally safe for browser use. Access is protected by the Row Level Security policies already configured in the Supabase project. Never add the database password, secret key, or `service_role` key to this repository.

Dropbox archiving uses the public Dropbox Saver App Key in `index.html`. No Dropbox secret or OAuth token is stored in this project. The Dropbox app must allow the domain `upload-portal-sthp.onrender.com`.

## Classes, camps and archive (September 28, 2026)

Students need no login. Share a URL with `?class=ete-221-oc-fl-26` to preselect
ETE 221 OC FL 26. Admin can create Class, Camp or Other groups, copy student
links, filter the inbox/archive by group, move submissions, archive and restore.
`archived_at` controls the Archive view; the legacy `status=archived` still means
saved to Dropbox. These actions are independent and neither deletes files.
All 39 submissions before September 28, 2026 midnight America/New_York were
archived. Existing group assignments remain unassigned until the owner moves them.
The original Dropbox source folder is preserved; this project is the updated copy.

Database migration `dropdesk_collections_and_archive` was applied to project
qgaanudqzldzjdmaskhu. New collections use RLS with the existing submission-admin
identity. Public clients can read the group list and submit but cannot read files
or submission records. Tests: `node tests/organizer.cjs`; transactional live SQL
verified public class reads/submission inserts, denied public submission reads
and class creation, and permitted owner class creation/submission updates.

The Supabase advisor also reported pre-existing settings: leaked-password
protection disabled, and public EXECUTE grants on the event-trigger function
`rls_auto_enable()`. This update does not change those existing settings.
