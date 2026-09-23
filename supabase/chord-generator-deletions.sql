-- Chord Generator: 削除の記録(tombstone)
-- 別端末の古いデータから、削除済みの進行・フォルダが復活するのを防ぐ。
-- Supabase の SQL Editor で1回実行する。未実行でもアプリは従来どおり動く
-- (その場合、削除の記録はそれぞれの端末の中だけで働く)。
create table if not exists public.chord_deletions (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('progression', 'folder')),
  deleted_at timestamptz not null default now()
);

create index if not exists chord_deletions_owner_id_idx
  on public.chord_deletions(owner_id);

alter table public.chord_deletions enable row level security;

drop policy if exists "chord_deletions_select_own" on public.chord_deletions;
create policy "chord_deletions_select_own"
  on public.chord_deletions for select
  using (auth.uid() = owner_id);

drop policy if exists "chord_deletions_insert_own" on public.chord_deletions;
create policy "chord_deletions_insert_own"
  on public.chord_deletions for insert
  with check (auth.uid() = owner_id);

drop policy if exists "chord_deletions_update_own" on public.chord_deletions;
create policy "chord_deletions_update_own"
  on public.chord_deletions for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "chord_deletions_delete_own" on public.chord_deletions;
create policy "chord_deletions_delete_own"
  on public.chord_deletions for delete
  using (auth.uid() = owner_id);
