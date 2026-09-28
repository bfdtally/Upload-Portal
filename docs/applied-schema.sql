-- Record of migration dropdesk_collections_and_archive applied September 28, 2026.
-- Do not rerun against the already-migrated production database.
create table public.collections (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) between 1 and 120),
 kind text not null default 'Class' check (kind in ('Class','Camp','Other')),
 slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 created_at timestamptz not null default now()
);
alter table public.collections enable row level security;
revoke all on public.collections from anon, authenticated;
grant select on public.collections to anon, authenticated;
grant insert, update on public.collections to authenticated;
create policy "Anyone can choose a collection" on public.collections for select to anon, authenticated using (true);
do $$
declare admin_check text;
begin
 select qual into strict admin_check from pg_policies where schemaname='public' and tablename='submissions' and policyname='Admin can view submissions';
 execute format('create policy "Admin can create collections" on public.collections for insert to authenticated with check (%s)', admin_check);
 execute format('create policy "Admin can edit collections" on public.collections for update to authenticated using (%s) with check (%s)',admin_check,admin_check);
end $$;
alter table public.submissions add column collection_id uuid references public.collections(id), add column archived_at timestamptz;
create index submissions_collection_id_idx on public.submissions(collection_id);
create index submissions_archived_at_idx on public.submissions(archived_at);
insert into public.collections(name,kind,slug) values ('ETE 221 OC FL 26','Class','ete-221-oc-fl-26');
alter policy "Visitors can create submissions" on public.submissions with check (status='new' and archived_at is null);
