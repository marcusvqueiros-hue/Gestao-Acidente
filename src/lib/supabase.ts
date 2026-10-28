import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** null = sem banco configurado: o app cai para o modo local (dados só neste navegador). */
export const supabase =
  url && key
    ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
    : null;

/**
 * O Supabase autentica por e-mail; o usuário digita apenas "@nome". Convertemos para um e-mail
 * interno que nunca é entregue (.invalid é um domínio reservado e inexistente).
 */
export const EMAIL_DOMINIO = "cgb.invalid";
export const normalizaUsuario = (u: string) => u.trim().replace(/^@/, "").toLowerCase();
export const emailDe = (usuario: string) => `${normalizaUsuario(usuario)}@${EMAIL_DOMINIO}`;
