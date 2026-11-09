-- NDGS (Nível de Desenvolvimento Global de Segurança): notas mensais por índice.
-- Rode uma vez em: Supabase → SQL Editor → New query → Run.
-- Todos os usuários logados leem; somente administradores gravam. Já traz jan–set/2026 da planilha.

create table if not exists public.ndgs (
  ano           integer not null,
  mes           integer not null check (mes between 1 and 12),
  icad          double precision,
  icit          double precision,
  icia          double precision,
  tfa           double precision,
  tga           double precision,
  ipws          double precision,
  valor         double precision,
  atualizado_em timestamptz not null default now(),
  primary key (ano, mes)
);

alter table public.ndgs enable row level security;

drop policy if exists ndgs_ler on public.ndgs;
drop policy if exists ndgs_gravar on public.ndgs;
create policy ndgs_ler    on public.ndgs for select to authenticated using (public.meu_perfil() is not null);
create policy ndgs_gravar on public.ndgs for all    to authenticated using (public.meu_perfil() = 'admin') with check (public.meu_perfil() = 'admin');

grant select, insert, update, delete on public.ndgs to authenticated;

insert into public.ndgs (ano, mes, icad, icit, icia, tfa, tga, ipws, valor) values
  (2026, 1, 0.93, 0.81,  0,   0, 0.9, 1, 0.683),
  (2026, 2, 0.93, 0.807, 0,   1, 1,   1, 0.8474),
  (2026, 3, 0.94, 0.806, 1,   1, 1,   1, 0.9492),
  (2026, 4, 0.94, 0.782, 1,   1, 1,   1, 0.9388),
  (2026, 5, 0.93, 0.82,  1,   1, 1,   1, 0.95),
  (2026, 6, 0.94, 0.874, 1,   1, 1,   1, 0.9628),
  (2026, 7, 0.94, 0.811, 1,   0, 0,   1, 0.5502),
  (2026, 8, 0.94, 0.742, 0.6, 1, 1,   1, 0.8964),
  (2026, 9, 0.94, 0.724, 1,   0, 1,   1, 0.7561)
on conflict (ano, mes) do update set
  icad = excluded.icad, icit = excluded.icit, icia = excluded.icia,
  tfa = excluded.tfa, tga = excluded.tga, ipws = excluded.ipws, valor = excluded.valor;

notify pgrst, 'reload schema';

select ano, mes, icad, icit, icia, tfa, tga, ipws, valor from public.ndgs order by ano, mes;
