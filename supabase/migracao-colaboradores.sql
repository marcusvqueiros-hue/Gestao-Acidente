-- Quadro de colaboradores: a tabela public.colaboradores JÁ EXISTE no banco (id = chapa; dados = JSON com
-- nome, funcao, base, gerencia...). Este sistema só lê. Falta apenas liberar a leitura para quem tem perfil.
-- Rode uma vez em: Supabase → SQL Editor → New query → Run.
-- Não altera nem apaga nenhum dado, não liga/desliga a segurança da tabela e não muda o acesso de outros apps.

drop policy if exists colaboradores_ler_perfis on public.colaboradores;
create policy colaboradores_ler_perfis on public.colaboradores
  for select to authenticated
  using (public.meu_perfil() is not null);

grant select on public.colaboradores to authenticated;
