
create table public.training_examples (
  id uuid primary key default gen_random_uuid(),
  image_path text not null,
  label text not null default 'successful_breakout',
  note text,
  symbol text,
  sector text,
  created_at timestamptz not null default now()
);

alter table public.training_examples enable row level security;

create policy "training_examples public read"
  on public.training_examples for select
  using (true);

create policy "training_examples public insert"
  on public.training_examples for insert
  with check (true);

create policy "training_examples public delete"
  on public.training_examples for delete
  using (true);

insert into storage.buckets (id, name, public)
values ('training-charts', 'training-charts', true);

create policy "training-charts public read"
  on storage.objects for select
  using (bucket_id = 'training-charts');

create policy "training-charts public upload"
  on storage.objects for insert
  with check (bucket_id = 'training-charts');
