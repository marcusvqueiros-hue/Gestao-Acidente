-- Cadastro de equipes (prefixos): base, gerência, coordenador e gerente de cada equipe.
-- Rode uma vez em: Supabase → SQL Editor → New query → Run.
-- Os dados (as equipes em si) entram pelo botão "Importar equipes" em Registros (administrador),
-- usando a planilha com as colunas: Prefixo, Base, Gerência, Coordenador, Gerente.

create table if not exists public.equipes (
  prefixo       text primary key,
  base          text not null default '',
  gerencia      text not null default '',
  coordenador   text not null default '',
  gerente       text not null default '',
  atualizado_em timestamptz not null default now()
);

drop trigger if exists equipes_carimbo on public.equipes;
create trigger equipes_carimbo before update on public.equipes
  for each row execute function public.carimbar_atualizacao();

alter table public.equipes enable row level security;
drop policy if exists equipes_ler on public.equipes;
drop policy if exists equipes_gravar on public.equipes;
create policy equipes_ler    on public.equipes for select to authenticated using (public.meu_perfil() is not null);
create policy equipes_gravar on public.equipes for all    to authenticated using (public.meu_perfil() = 'admin') with check (public.meu_perfil() = 'admin');

revoke all on public.equipes from anon;
grant select, insert, update, delete on public.equipes to authenticated;
