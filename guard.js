/* ==========================================================
   Porteiro: sem sessão, ninguém entra na comunidade.

   IMPORTANTE, sem rodeio: isto é uma PORTA, não um cofre. O site é
   estático e o repositório é público — quem souber procurar acha o
   HTML. O que fica de fato protegido são os DADOS (os posts do
   mural), porque quem recusa o acesso a eles é o banco, via RLS, e
   não esta linha de JavaScript.
   ========================================================== */

import { sb, URL_LOGIN } from "./supabase.js";

/* O Google não devolve a sessão pronta: ele devolve um CÓDIGO na
   URL (?code=...), e a biblioteca precisa trocá-lo por uma sessão.
   Essa troca é assíncrona.

   Perguntar "tem sessão?" na hora que a página carrega devolve NÃO,
   porque a troca ainda está em curso — e aí o porteiro chutaria pra
   fora justamente quem acabou de fazer login. Por isso: se a URL
   traz um código, espero a troca terminar antes de decidir. */
const temCodigoNaUrl = /[?&]code=|[#&]access_token=/.test(
  window.location.search + window.location.hash
);

function esperarSessao(limiteMs) {
  return new Promise((resolve) => {
    const { data } = sb.auth.onAuthStateChange((_evento, sessao) => {
      if (sessao) {
        data.subscription.unsubscribe();
        resolve(sessao);
      }
    });
    // Se a troca falhar de vez, não deixo a pessoa presa numa tela
    // em branco pra sempre: desisto e mando pro login.
    setTimeout(() => {
      data.subscription.unsubscribe();
      resolve(null);
    }, limiteMs);
  });
}

let sessao = (await sb.auth.getSession()).data.session;

if (!sessao && temCodigoNaUrl) {
  sessao = await esperarSessao(8000);
}

if (!sessao) {
  // replace() e não href: assim o "voltar" do navegador não devolve
  // a pessoa pra uma página que ela não pode ver.
  window.location.replace(URL_LOGIN);
} else {
  /* Limpa o ?code= da barra de endereço. Sem isso, a pessoa fica com
     uma URL feia e cheia de código — e, se recarregar, o navegador
     tenta reusar um código já gasto, o que gera erro. */
  if (temCodigoNaUrl) {
    window.history.replaceState({}, "", window.location.pathname);
  }

  // Libera a página, que nasce escondida pra ninguém ver um lampejo
  // do conteúdo antes da checagem terminar.
  document.documentElement.dataset.checando = "0";
}

// Se a pessoa sair (aqui ou em outra aba), volta pro login.
sb.auth.onAuthStateChange((_e, s) => {
  if (!s) window.location.replace(URL_LOGIN);
});
