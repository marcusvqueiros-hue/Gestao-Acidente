-- Administradores do sistema: Marcus Vinicius (12375), Everton Siqueira (12813),
-- Antonio Silva de Abreu (12891) e Daniel Silva de Assis (24958).
-- Somente administradores veem as abas Registros e Usuários, e cadastram registros.
-- Rode uma vez em: Supabase → SQL Editor → New query → Run.
update public.perfis set perfil = 'admin' where usuario = '@AntonioAbreu';
select usuario, perfil from public.perfis order by usuario;
