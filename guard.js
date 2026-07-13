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

/* Tela de aviso. Página branca sem explicação é o pior desfecho
   possível, então TODA saída ruim passa por aqui. */
function telaAviso(titulo, motivo, rotuloBotao, aoClicar) {
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
  t.style.cssText = "font-size:1.15rem;font-weight:600;";
  t.textContent = titulo;

  const m = document.createElement("p");
  m.style.cssText = "font-size:.88rem;color:#666;max-width:46ch;line-height:1.6;";
  m.textContent = motivo;

  const b = document.createElement("button");
  b.textContent = rotuloBotao;
  b.style.cssText = `
    padding:12px 26px;border:none;border-radius:999px;background:#1B5CF5;
    color:#fff;font-size:.9rem;font-weight:500;cursor:pointer;
  `;
  b.addEventListener("click", aoClicar);

  caixa.append(t, m, b);
  document.body.append(caixa);
}

function falhar(motivo) {
  telaAviso("Não consegui te conectar", motivo, "Tentar de novo", () => {
    window.location.replace(URL_LOGIN);
  });
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

    /* ---------- A pessoa é da turma? ----------
       Ter conta no Google não basta: a comunidade é fechada. Quem
       responde é o BANCO — esta checagem aqui é só pra dar uma
       mensagem decente. Mesmo que alguém burlasse este `if`, não
       veria post nenhum: o RLS recusa a leitura de quem não está
       na lista. */
    const { data: daTurma, error: erroLista } = await sb.rpc("eh_aluna");

    if (erroLista) {
      falhar("Não consegui verificar seu acesso: " + erroLista.message);
      throw erroLista;
    }

    if (!daTurma) {
      const email = sessao.user?.email || "sua conta";
      telaAviso(
        "Você ainda não está na turma",
        `A conta ${email} não está na lista de alunas da comunidade. ` +
        `Se você faz parte da imersão, avise a organização para liberar ` +
        `esse e-mail — ou entre com a conta que você usou na inscrição.`,
        "Sair e tentar outra conta",
        async () => {
          await sb.auth.signOut();
          window.location.replace(URL_LOGIN);
        }
      );
      throw new Error("fora da lista");
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
