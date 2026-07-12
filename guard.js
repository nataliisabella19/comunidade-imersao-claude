/* ==========================================================
   Porteiro: sem sessão, ninguém entra na comunidade.

   IMPORTANTE, e vale dizer sem rodeio: isto é uma PORTA, não um
   cofre. O site é estático e o repositório é público — quem souber
   procurar acha o HTML. O que fica de fato protegido são os DADOS
   (os posts do mural), porque quem recusa o acesso a eles é o
   banco, via RLS, e não esta linha de JavaScript.
   ========================================================== */

import { sb, URL_LOGIN } from "./supabase.js";

const { data: { session } } = await sb.auth.getSession();

if (!session) {
  // replace() e não href: assim o "voltar" do navegador não devolve
  // a pessoa pra uma página que ela não pode ver.
  window.location.replace(URL_LOGIN);
} else {
  // Libera a página, que nasce escondida pra ninguém ver um lampejo
  // do conteúdo antes da checagem terminar.
  document.documentElement.dataset.checando = "0";
}

// Se a pessoa sair (aqui ou em outra aba), volta pro login.
sb.auth.onAuthStateChange((_e, sessao) => {
  if (!sessao) window.location.replace(URL_LOGIN);
});
