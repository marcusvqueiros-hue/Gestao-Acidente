-- Migração: cálculo das taxas (NBR 14280). Rode uma vez no SQL Editor do Supabase.
-- Exige que o esquema principal (schema.sql) já tenha sido executado.

-- ============ Cálculo das taxas (NBR 14280) ============
-- Pode ser rodado sozinho, mesmo em um banco que já tinha o esquema anterior.
alter table public.registros add column if not exists dias_debitados integer;

create table if not exists public.exposicao (
  ano           integer not null,
  mes           integer not null check (mes between 1 and 12),
  horas         double precision not null check (horas > 0),
  atualizado_em timestamptz not null default now(),
  primary key (ano, mes)
);

create table if not exists public.configuracao (
  chave         text primary key,
  valor         jsonb not null,
  atualizado_em timestamptz not null default now()
);

drop trigger if exists exposicao_carimbo on public.exposicao;
create trigger exposicao_carimbo before update on public.exposicao
  for each row execute function public.carimbar_atualizacao();
drop trigger if exists configuracao_carimbo on public.configuracao;
create trigger configuracao_carimbo before update on public.configuracao
  for each row execute function public.carimbar_atualizacao();

alter table public.exposicao     enable row level security;
alter table public.configuracao  enable row level security;

drop policy if exists exposicao_ler on public.exposicao;
drop policy if exists exposicao_gravar on public.exposicao;
drop policy if exists configuracao_ler on public.configuracao;
drop policy if exists configuracao_gravar on public.configuracao;

create policy exposicao_ler    on public.exposicao    for select to authenticated using (public.meu_perfil() is not null);
create policy exposicao_gravar on public.exposicao    for all    to authenticated using (public.meu_perfil() = 'admin') with check (public.meu_perfil() = 'admin');
create policy configuracao_ler    on public.configuracao for select to authenticated using (public.meu_perfil() is not null);
create policy configuracao_gravar on public.configuracao for all    to authenticated using (public.meu_perfil() = 'admin') with check (public.meu_perfil() = 'admin');

revoke all on public.exposicao, public.configuracao from anon;
grant select, insert, update, delete on public.exposicao, public.configuracao to authenticated;

do $
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'exposicao') then
    alter publication supabase_realtime add table public.exposicao;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'configuracao') then
    alter publication supabase_realtime add table public.configuracao;
  end if;
end
$;
