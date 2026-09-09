-- Research OS — documentos regulatórios privados
-- O primeiro segmento do path é sempre auth.uid().

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'research-regulatory-documents',
  'research-regulatory-documents',
  false,
  10485760,
  array['application/pdf', 'image/png', 'image/jpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "research regulatory documents select own" on storage.objects;
create policy "research regulatory documents select own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'research-regulatory-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "research regulatory documents insert own" on storage.objects;
create policy "research regulatory documents insert own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'research-regulatory-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "research regulatory documents delete own" on storage.objects;
create policy "research regulatory documents delete own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'research-regulatory-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
