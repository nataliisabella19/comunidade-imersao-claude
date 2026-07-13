/* ==========================================================
   Conexão com o Supabase — usada pelo login e pelo mural.

   A chave abaixo é a `anon`, e ela é PÚBLICA por natureza: todo
   site que usa Supabase a expõe no código. Quem protege os dados
   não é o segredo dela, e sim as regras de RLS no banco
   (ver supabase-setup.sql).

   A chave `service_role` NUNCA pode entrar aqui — ela ignora o RLS
   e daria acesso total ao banco a qualquer aluno que abrisse o
   código-fonte da página.
   ========================================================== */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const SUPABASE_URL  = "https://hlyjhofiotsverogkorg.supabase.co";
export const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhseWpob2Zpb3RzdmVyb2drb3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4ODcwNDgsImV4cCI6MjA5OTQ2MzA0OH0.id4-EmVN64IsbHaCFQUccDRkFi2SYYCH0IH9Pe8IEFc";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

/* Caminho da pasta do site (ex.: "/comunidade-imersao-claude/").
   Escrever a URL na mão quebraria ao abrir o site local ou ao
   trocar pro domínio próprio. */
const base = window.location.pathname.replace(/[^/]*$/, "");

/* A entrada aponta pra PASTA, não pra "index.html".

   Isso é obrigatório: o Supabase só aceita devolver o aluno numa URL
   que bata EXATAMENTE com a lista de Redirect URLs do painel — e lá
   está cadastrado ".../comunidade-imersao-claude/", com barra no fim.
   Pedir ".../index.html" não bate, o Supabase recusa e cai num plano
   B silencioso. O servidor entrega o mesmo index.html nos dois casos,
   então não se perde nada. */
export const URL_ENTRADA = window.location.origin + base;
export const URL_LOGIN   = window.location.origin + base + "login.html";
