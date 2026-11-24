-- Plano de ação dos sinistros (planilha "PLANO DE AÇÃO RIAI 2026").
-- Rode uma vez em: Supabase → SQL Editor → New query → Run.
-- Todos os usuários logados leem; somente administradores gravam. As ações da planilha vão pelo arquivo plano-acao-dados.sql (só na máquina local) ou pelo botão Importar planilha da aba.

create table if not exists public.plano_acoes (
  id            text primary key,
  registro_id   text,
  data_evento   date not null,
  nome          text not null default '',
  area          text not null default '',
  acao          text not null default '',
  base          text not null default '',
  responsavel   text not null default '',
  prazo         date,
  situacao      text not null default 'PENDENTE' check (situacao in ('CONCLUIDO', 'EM ANDAMENTO', 'PENDENTE', 'ATRASADO')),
  concluido_em  date,
  atualizado_em timestamptz not null default now()
);

-- Tipo do plano: RIAI (todos os já existentes) ou QUADRANTE. Pode rodar de novo sem problema.
alter table public.plano_acoes add column if not exists tipo text not null default 'RIAI';
alter table public.plano_acoes add column if not exists coordenador text;
alter table public.plano_acoes drop constraint if exists plano_acoes_tipo_check;
alter table public.plano_acoes add constraint plano_acoes_tipo_check check (tipo in ('RIAI', 'QUADRANTE'));

alter table public.plano_acoes enable row level security;

drop policy if exists plano_acoes_ler on public.plano_acoes;
drop policy if exists plano_acoes_gravar on public.plano_acoes;
create policy plano_acoes_ler    on public.plano_acoes for select to authenticated using (public.meu_perfil() is not null);
create policy plano_acoes_gravar on public.plano_acoes for all    to authenticated using (public.meu_perfil() = 'admin') with check (public.meu_perfil() = 'admin');

grant select, insert, update, delete on public.plano_acoes to authenticated;

notify pgrst, 'reload schema';

select situacao, count(*) from public.plano_acoes group by situacao order by situacao;
