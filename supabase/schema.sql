-- CGB · Gestão de Acidentalidade — esquema do banco (Supabase)
-- Rode este arquivo inteiro uma vez em: Supabase → SQL Editor → New query → Run.
-- Pode ser rodado de novo sem estragar nada (usa "if not exists" / "or replace").

-- ============ Perfis de acesso ============
create table if not exists public.perfis (
  id        uuid primary key references auth.users (id) on delete cascade,
  usuario   text not null unique,
  perfil    text not null check (perfil in ('admin', 'registrador', 'leitor')),
  criado_em timestamptz not null default now()
);

-- Perfil do usuário logado (null = conta sem acesso liberado). security definer evita recursão nas políticas.
create or replace function public.meu_perfil()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select perfil from public.perfis where id = auth.uid()
$$;

-- ============ Registros (acidentes e incidentes internos) ============
create table if not exists public.registros (
  id              text primary key default gen_random_uuid()::text,
  categoria       text not null check (categoria in ('acidente', 'incidente_interno')),
  data            date not null,
  hora            text,
  turno           text not null default '',
  colaborador     text not null default '',
  prefixo         text not null default '',
  processo        text not null default '',
  base            text not null default '',
  cidade          text not null default '',
  supervisor      text not null default '',
  tipo            text not null default '',
  caracteristica  text not null default '',
  definicao       text not null default '',
  descricao       text not null default '',
  envolvidos      text not null default 'PRÓPRIOS' check (envolvidos in ('PRÓPRIOS', 'TERCEIROS')),
  gravidade       text not null default '',
  lesao           text not null default '',
  cat             text not null default '',
  trajeto         text not null default '',
  comunicado_eqtl text not null default '',
  dias_perdidos   integer,
  acoes           jsonb not null default '[]'::jsonb,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid default auth.uid()
);
create index if not exists registros_data_idx on public.registros (data);
create index if not exists registros_categoria_idx on public.registros (categoria);

-- ============ Taxas mensais (TF, TFCA, TG e metas) ============
create table if not exists public.taxas (
  ano           integer not null,
  mes           integer not null check (mes between 1 and 12),
  tg            double precision not null default 0,
  meta_tg       double precision not null default 0,
  tf            double precision not null default 0,
  tfca          double precision not null default 0,
  meta_tf       double precision not null default 0,
  atualizado_em timestamptz not null default now(),
  primary key (ano, mes)
);

-- carimbo de atualização automático
create or replace function public.carimbar_atualizacao()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists registros_carimbo on public.registros;
create trigger registros_carimbo before update on public.registros
  for each row execute function public.carimbar_atualizacao();

drop trigger if exists taxas_carimbo on public.taxas;
create trigger taxas_carimbo before update on public.taxas
  for each row execute function public.carimbar_atualizacao();

-- ============ Segurança (RLS) ============
-- Regra: quem tem perfil (admin ou leitor) lê tudo; somente admin grava.
-- Contas sem linha em "perfis" não enxergam nada, mesmo que consigam criar login.
alter table public.perfis    enable row level security;
alter table public.registros enable row level security;
alter table public.taxas     enable row level security;

drop policy if exists perfis_ler        on public.perfis;
drop policy if exists registros_ler     on public.registros;
drop policy if exists registros_inserir on public.registros;
drop policy if exists registros_editar  on public.registros;
drop policy if exists registros_excluir on public.registros;
drop policy if exists taxas_ler         on public.taxas;
drop policy if exists taxas_inserir     on public.taxas;
drop policy if exists taxas_editar      on public.taxas;
drop policy if exists taxas_excluir     on public.taxas;

-- cada um lê o próprio perfil; admin lê todos. Escrita em perfis só pelo servidor (service role).
create policy perfis_ler on public.perfis for select to authenticated
  using (id = auth.uid() or public.meu_perfil() = 'admin');

create policy registros_ler     on public.registros for select to authenticated using (public.meu_perfil() is not null);
create policy registros_inserir on public.registros for insert to authenticated with check (public.meu_perfil() in ('admin', 'registrador'));
create policy registros_editar  on public.registros for update to authenticated using (public.meu_perfil() in ('admin', 'registrador')) with check (public.meu_perfil() in ('admin', 'registrador'));
create policy registros_excluir on public.registros for delete to authenticated using (public.meu_perfil() in ('admin', 'registrador'));

create policy taxas_ler     on public.taxas for select to authenticated using (public.meu_perfil() is not null);
create policy taxas_inserir on public.taxas for insert to authenticated with check (public.meu_perfil() = 'admin');
create policy taxas_editar  on public.taxas for update to authenticated using (public.meu_perfil() = 'admin') with check (public.meu_perfil() = 'admin');
create policy taxas_excluir on public.taxas for delete to authenticated using (public.meu_perfil() = 'admin');

-- o papel "anon" (visitante sem login) não acessa nada
revoke all on public.perfis, public.registros, public.taxas from anon;
grant select on public.perfis to authenticated;
grant select, insert, update, delete on public.registros, public.taxas to authenticated;

-- ============ Atualização em tempo real entre aparelhos ============
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'registros') then
    alter publication supabase_realtime add table public.registros;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'taxas') then
    alter publication supabase_realtime add table public.taxas;
  end if;
end
$$;

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

-- ============ PASSO FINAL: liberar o primeiro administrador ============
-- 1) Em Authentication → Users → Add user → Create new user:
--      e-mail: marcusqueiros@cgb.invalid   senha: a sua   [x] Auto Confirm User
-- 2) Rode o comando abaixo (depois de criar o usuário):
--
-- insert into public.perfis (id, usuario, perfil)
-- select id, '@MarcusQueiros', 'admin' from auth.users where email = 'marcusqueiros@cgb.invalid'
-- on conflict (id) do update set perfil = 'admin';
