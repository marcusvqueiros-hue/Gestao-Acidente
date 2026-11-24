-- Corrige a base "SIT" (erro de digitação) para "STI" (Santa Inês) nos dados já gravados.
-- Rode uma vez em: Supabase → SQL Editor → New query → Run.

update public.registros set base = 'STI' where upper(trim(base)) = 'SIT';
update public.equipes   set base = 'STI' where upper(trim(base)) = 'SIT';
update public.plano_acoes set base = 'STI' where upper(trim(base)) = 'SIT';

select 'registros' as tabela, count(*) as ainda_com_sit from public.registros where upper(trim(base)) = 'SIT'
union all select 'equipes', count(*) from public.equipes where upper(trim(base)) = 'SIT'
union all select 'plano_acoes', count(*) from public.plano_acoes where upper(trim(base)) = 'SIT';
