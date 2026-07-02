# DropDesk

A private client file-delivery portal backed by Supabase.

## Features

- Multiple file uploads to a private Supabase Storage bucket
- Submission metadata stored in Supabase Postgres
- Administrator login through Supabase Auth
- Searchable submission dashboard
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
