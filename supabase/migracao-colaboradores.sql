-- Quadro de colaboradores (planilha do QSMS): chapa, nome, função, base, processo, gerência e situação.
-- Rode uma vez em: Supabase → SQL Editor → New query → Run.
-- Os dados entram pelo botão "Importar colaboradores" em Registros (administrador),
-- com a planilha do QSMS (aba "Base": CHAPA, NOME, FUNÇÃO, BASE, PROCESSO, GERENCIA, SITUAÇÃO).

create table if not exists public.colaboradores (
  chapa         text primary key,
  nome          text not null,
  funcao        text not null default '',
  base          text not null default '',
  processo      text not null default '',
  gerencia      text not null default '',
  situacao      text not null default '',
  atualizado_em timestamptz not null default now()
);
create index if not exists colaboradores_nome_idx on public.colaboradores (nome);

drop trigger if exists colaboradores_carimbo on public.colaboradores;
create trigger colaboradores_carimbo before update on public.colaboradores
  for each row execute function public.carimbar_atualizacao();

alter table public.colaboradores enable row level security;
drop policy if exists colaboradores_ler on public.colaboradores;
drop policy if exists colaboradores_gravar on public.colaboradores;
create policy colaboradores_ler    on public.colaboradores for select to authenticated using (public.meu_perfil() is not null);
create policy colaboradores_gravar on public.colaboradores for all    to authenticated using (public.meu_perfil() = 'admin') with check (public.meu_perfil() = 'admin');

revoke all on public.colaboradores from anon;
grant select, insert, update, delete on public.colaboradores to authenticated;
