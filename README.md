# CGB · Gestão de Acidentalidade

React + Vite + TypeScript, gerenciado com Bun. Dados e login no Supabase.

```bash
bun install
bun run dev      # http://localhost:5173
bun run build
```

## Configuração do Supabase (uma vez)

1. **Tabelas e segurança:** Supabase → SQL Editor → cole e rode `supabase/schema.sql`.
2. **Primeiro administrador:** Authentication → Users → *Add user* → e-mail `marcusqueiros@cgb.invalid`, a senha desejada, marcando *Auto Confirm User*. Depois rode o `insert into public.perfis ...` que está no final do `schema.sql`.
3. **Senha mínima:** Authentication → Sign In / Providers → Email → *Minimum password length*: se a senha tiver menos de 6 caracteres (ex.: `12375`), reduza para 4.
4. **Cadastro aberto:** na mesma tela, desligue *Allow new users to sign up* (usuários novos só são criados pelo administrador no app).
5. **Gerenciar usuários pelo app:** no Vercel → Settings → Environment Variables, crie `SUPABASE_SERVICE_ROLE_KEY` (chave *service_role* do Supabase, nunca no código nem no navegador) e refaça o deploy.
6. Entre no app como administrador e use **Registros → Importar** para carregar a planilha (abas BASE, INCIDENTES INTERNOS e TG e TF).

## Como funciona

- O usuário digita `@nome`; internamente vira o e-mail `nome@cgb.invalid` (domínio reservado, nunca entregue).
- `perfis` define o acesso: `admin` lê e grava; `leitor` só lê. Quem não tem perfil não enxerga nenhum dado (RLS).
- Alterações aparecem em tempo real nos outros aparelhos.
- Sem as variáveis `VITE_SUPABASE_*` (`.env`), o app cai para o modo local (dados só neste navegador).
- `scripts/seed.json` e `scripts/base.xlsx` são cópias locais da planilha, fora do site publicado.
