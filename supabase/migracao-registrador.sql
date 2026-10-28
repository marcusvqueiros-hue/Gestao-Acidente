-- Perfil "registrador": vê tudo (menos a aba Usuários) e cadastra/edita/exclui registros de acidentes.
-- Taxas, horas-homem, critérios e usuários continuam só com administradores.
-- Rode uma vez em: Supabase → SQL Editor → New query → Run.
-- ATENÇÃO: troque SENHA_AQUI (1 ocorrência por linha abaixo) pela senha do usuário antes de rodar.
-- Não salve a senha neste arquivo no Git.

alter table public.perfis drop constraint if exists perfis_perfil_check;
alter table public.perfis add constraint perfis_perfil_check check (perfil in ('admin', 'registrador', 'leitor'));

drop policy if exists registros_inserir on public.registros;
drop policy if exists registros_editar  on public.registros;
drop policy if exists registros_excluir on public.registros;
create policy registros_inserir on public.registros for insert to authenticated with check (public.meu_perfil() in ('admin', 'registrador'));
create policy registros_editar  on public.registros for update to authenticated using (public.meu_perfil() in ('admin', 'registrador')) with check (public.meu_perfil() in ('admin', 'registrador'));
create policy registros_excluir on public.registros for delete to authenticated using (public.meu_perfil() in ('admin', 'registrador'));

-- Usuário @AntonioAbreu (registrador)
do $$
declare
  uid uuid;
  mail text := 'antonioabreu@cgb.invalid';
  senha text := 'SENHA_AQUI';
begin
  select id into uid from auth.users where email = mail;
  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail,
            extensions.crypt(senha, extensions.gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', mail, 'email_verified', true), 'email', now(), now(), now());
  else
    update auth.users set encrypted_password = extensions.crypt(senha, extensions.gen_salt('bf')) where id = uid;
  end if;
  insert into public.perfis (id, usuario, perfil) values (uid, '@AntonioAbreu', 'registrador')
  on conflict (id) do update set perfil = 'registrador', usuario = '@AntonioAbreu';
end
$$;

select usuario, perfil from public.perfis order by usuario;
