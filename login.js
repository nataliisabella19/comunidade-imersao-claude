/* ==========================================================
   Página de login — porta de entrada da comunidade
   ========================================================== */

import { sb, URL_ENTRADA } from "./supabase.js";

const botao  = document.getElementById("btn-entrar");
const recado = document.getElementById("login-recado");

function erro(msg) {
  if (!recado) return;
  recado.textContent = msg;
  recado.dataset.erro = "1";
}

/* Quem já está logado não precisa ver esta tela: entra direto.
   Uso replace() e não href: assim o botão "voltar" do navegador
   não devolve a pessoa pra tela de login, num vai-e-volta infinito. */
const { data: { session } } = await sb.auth.getSession();
if (session) {
  window.location.replace(URL_ENTRADA);
}

botao?.addEventListener("click", async () => {
  botao.disabled = true;

  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: URL_ENTRADA },
  });

  if (error) {
    erro("Não consegui abrir o login: " + error.message);
    botao.disabled = false;
  }
});

/* O login do Google volta pra cá em alguns fluxos. Se a sessão
   aparecer, segue pra comunidade. */
sb.auth.onAuthStateChange((_e, sessao) => {
  if (sessao) window.location.replace(URL_ENTRADA);
});
