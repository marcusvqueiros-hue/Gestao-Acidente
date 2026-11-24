-- Somente administradores alteram dados: registros de sinistros passam a ser gravados só por admin.
-- (Taxas, horas-homem, NDGS, plano de ação, equipes e usuários já eram só de admin.)
-- Rode uma vez em: Supabase → SQL Editor → New query → Run.

drop policy if exists registros_inserir on public.registros;
drop policy if exists registros_editar  on public.registros;
drop policy if exists registros_excluir on public.registros;
create policy registros_inserir on public.registros for insert to authenticated with check (public.meu_perfil() = 'admin');
create policy registros_editar  on public.registros for update to authenticated using (public.meu_perfil() = 'admin') with check (public.meu_perfil() = 'admin');
create policy registros_excluir on public.registros for delete to authenticated using (public.meu_perfil() = 'admin');

select tablename, policyname, cmd from pg_policies where schemaname = 'public' and cmd <> 'SELECT' order by tablename, policyname;
