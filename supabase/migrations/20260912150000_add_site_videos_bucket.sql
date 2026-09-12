-- Public bucket for short site videos (homepage tour, About Us, driving
-- directions) — uploaded directly from the browser to Supabase Storage,
-- not proxied through a Next.js API route (Vercel's serverless function
-- body cap is ~4.5MB, far too small for video). RLS below is what
-- actually enforces "admin only" for writes, same as site-images.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-videos', 'site-videos', true, 104857600, array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do nothing;

create policy "anyone can view site videos" on storage.objects
  for select using (bucket_id = 'site-videos');

create policy "admins manage site videos" on storage.objects
  for all
  using (bucket_id = 'site-videos' and auth.uid() in (select id from admin_users))
  with check (bucket_id = 'site-videos' and auth.uid() in (select id from admin_users));
