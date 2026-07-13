/* ==========================================================
   Porteiro: sem sessão, ninguém entra na comunidade.

   Isto é uma PORTA, não um cofre. O site é estático e o repositório
   é público. O que fica de fato protegido são os DADOS (os posts),
   porque quem recusa acesso a eles é o banco, via RLS — não esta
   linha de JavaScript.

   Regra de ouro deste arquivo: ele NUNCA pode morrer em silêncio.
   A página nasce escondida esperando por ele; se ele falhar sem
   avisar, o aluno vê uma tela branca eterna e não tem como saber
   o que aconteceu. Por isso tudo aqui está dentro de try/catch e
   qualquer falha vira mensagem na tela.
   ========================================================== */

import { sb, URL_LOGIN } from "./supabase.js";

function revelar() {
  document.documentElement.dataset.checando = "0";
}

/* Falhou? Mostra o motivo na tela, com um caminho de saída.
   Página branca sem explicação é o pior desfecho possível. */
function falhar(motivo) {
  revelar();
  const caixa = document.createElement("div");
  caixa.setAttribute("role", "alert");
  caixa.style.cssText = `
    position:fixed; inset:0; z-index:9999; display:flex;
    flex-direction:column; align-items:center; justify-content:center;
    gap:16px; padding:32px; text-align:center; background:#fff;
    font-family:system-ui,sans-serif; color:#1B1A18;
  `;

  const t = document.createElement("p");
  t.style.cssText = "font-size:1.1rem;font-weight:600;";
  t.textContent = "Não consegui te conectar";

  const m = document.createElement("p");
  m.style.cssText = "font-size:.85rem;color:#666;max-width:44ch;line-height:1.5;";
  m.textContent = motivo;

  const a = document.createElement("a");
  a.href = URL_LOGIN;
  a.textContent = "Tentar de novo";
  a.style.cssText = `
    padding:12px 24px;border-radius:999px;background:#1B5CF5;
    color:#fff;text-decoration:none;font-size:.9rem;font-weight:500;
  `;

  caixa.append(t, m, a);
  document.body.append(caixa);
}

try {
  /* O Google não devolve a sessão pronta: devolve um CÓDIGO na URL
     (?code=...), que precisa ser TROCADO por uma sessão. A troca é
     assíncrona.

     Perguntar "tem sessão?" assim que a página carrega responde NÃO,
     porque a troca ainda está em curso — e o porteiro chutaria pra
     fora justamente quem acabou de logar. Por isso faço a troca de
     forma EXPLÍCITA aqui, em vez de torcer pra biblioteca ter
     terminado a dela a tempo. */
  const params = new URLSearchParams(window.location.search);
  const codigo = params.get("code");
  const erroGoogle = params.get("error_description") || params.get("error");

  if (erroGoogle) {
    falhar(erroGoogle);
    throw new Error("erro vindo do provedor");
  }

  let sessao = (await sb.auth.getSession()).data.session;

  if (!sessao && codigo) {
    const { data, error } = await sb.auth.exchangeCodeForSession(codigo);
    if (error) {
      falhar("O código de login não foi aceito: " + error.message);
      throw error;
    }
    sessao = data.session;
  }

  if (!sessao) {
    // replace() e não href: o "voltar" do navegador não deve devolver
    // a pessoa pra uma página que ela não pode ver.
    window.location.replace(URL_LOGIN);
  } else {
    /* Limpa o ?code= da barra de endereço. Sem isso a URL fica feia
       e, se a pessoa recarregar, o navegador tenta reusar um código
       já gasto — o que gera erro. */
    if (codigo) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    revelar();
  }

  // Se a pessoa sair (aqui ou em outra aba), volta pro login.
  sb.auth.onAuthStateChange((_e, s) => {
    if (!s) window.location.replace(URL_LOGIN);
  });

} catch (e) {
  console.error("[porteiro]", e);
  // Se ainda estiver escondida, mostra o erro em vez de tela branca.
  if (document.documentElement.dataset.checando === "1") {
    falhar(String(e?.message || e));
  }
}
