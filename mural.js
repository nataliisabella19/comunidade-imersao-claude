/* ==========================================================
   Mural — compositor de posts

   ATENÇÃO (importante): o site é estático, sem servidor.
   Os posts são gravados no localStorage, ou seja, ficam SÓ no
   navegador de quem escreveu. Ninguém mais enxerga. É uma
   demonstração de interface, não uma comunidade funcionando.
   Pra virar um mural de verdade, precisa de um backend.

   ========================================================== */

/* ---------------- Carrossel 3D — desliza pro lado ----------------
   O "centro" é um número CONTÍNUO, não um índice. Quando vale 2.4,
   o carrossel está genuinamente ENTRE o card 2 e o 3, meio girado —
   é isso que permite a fita acompanhar o dedo em vez de saltar.

   A coleção é FINITA (do card 0 ao n-1), não circular. A versão
   circular anterior fazia o card mais afastado "dar a volta" e
   reaparecer do outro lado — perto das pontas isso virava um
   teleporte visível. Era a bugada.
   ---------------------------------------------------------------- */
(function () {
  const trilho = document.getElementById("trilho");
  if (!trilho) return;

  const cards = Array.from(trilho.children);
  const n = cards.length;
  if (!n) return;

  const VISIVEIS = 2;    // quantos cards aparecem de cada lado
  const EASING = 0.12;   // o quão rápido o carrossel alcança o alvo
  const PX_POR_CARD = 200;  // quantos pixels de arrasto valem um card
  const LIMIAR = 5;      // px pra virar arrasto (abaixo disso, é clique)

  const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const limitar = (v) => Math.max(0, Math.min(n - 1, v));

  let alvo = Math.floor(n / 2);
  let atual = alvo;

  // Distância até o centro, com sinal. Sem volta: o primeiro card é
  // o primeiro, e ponto.
  const distancia = (i) => i - atual;

  function render() {
    cards.forEach((card, i) => {
      const d = distancia(i);
      const dist = Math.abs(d);

      // O CSS resolve toda a geometria a partir de --pos.
      card.style.setProperty("--pos", d.toFixed(3));

      // Com centro fracionário ninguém fica exatamente em zero:
      // "ativo" é quem está mais perto do meio.
      const ehCentro = dist < 0.5;
      card.dataset.ativo = ehCentro ? "1" : "0";
      card.dataset.longe = dist > VISIVEIS + 0.5 ? "1" : "0";
      card.setAttribute("aria-hidden", ehCentro ? "false" : "true");
    });
  }

  /* ---------- Loop de animação ----------
     `alvo` é a única fonte da verdade. Arrasto, clique e teclado só
     mudam o alvo; o loop apenas persegue. */
  let rodando = false;

  function tique() {
    atual += (alvo - atual) * EASING;

    if (Math.abs(alvo - atual) < 0.001) {
      atual = alvo;
      render();
      rodando = false;   // chegou: para o loop em vez de girar à toa
      return;
    }

    render();
    requestAnimationFrame(tique);
  }

  function animar() {
    if (rodando || reduzir) return;
    rodando = true;
    requestAnimationFrame(tique);
  }

  /* ==========================================================
     O CURSOR COMANDA (sem clicar, sem segurar)

     Mapeamento direto: a posição do mouse ao longo do palco É a
     posição na coleção. Mouse na borda esquerda = primeiro card;
     na borda direita = último.

     Escolhi assim de propósito. A versão anterior somava um
     deslocamento a partir do meio, o que deixava o alvo ESTOURAR
     as pontas (ir além do último card) — e era daí que vinha a
     bugada. Com o mapeamento direto, o fim da faixa é o fim da
     coleção: não existe "além".
     ========================================================== */
  const temHover = window.matchMedia("(hover: hover)").matches;

  if (temHover && !reduzir) {
    const palco = trilho.parentElement || trilho;

    palco.addEventListener("pointermove", (e) => {
      const r = trilho.getBoundingClientRect();

      // Uma margem morta nas laterais: sem ela, seria impossível
      // parar no primeiro ou no último card — bastaria um pixel de
      // sobra pra escapar da ponta.
      const margem = r.width * 0.12;
      const util = r.width - margem * 2;
      const bruto = (e.clientX - r.left - margem) / util;   // 0 .. 1

      alvo = limitar(bruto * (n - 1));
      animar();
    }, { passive: true });

    // Cursor saiu: encaixa no card mais próximo em vez de largar a
    // fita num meio-termo torto, com dois cards pela metade.
    palco.addEventListener("pointerleave", () => {
      alvo = limitar(Math.round(atual));
      animar();
    }, { passive: true });
  }

  /* ---------- Celular: deslizar com o dedo ----------
     Não existe cursor pairando no toque, então lá o gesto é o
     arrasto mesmo. */
  let arrastando = false;
  let arrastou = false;
  let x0 = 0;
  let alvo0 = 0;

  trilho.addEventListener("pointerdown", (e) => {
    if (temHover || e.button !== 0) return;
    arrastando = true;
    arrastou = false;
    x0 = e.clientX;
    alvo0 = atual;
    trilho.classList.add("deslizando");
  });

  trilho.addEventListener("pointermove", (e) => {
    if (!arrastando) return;
    const dx = e.clientX - x0;

    // Folga: sem ela, o tremor do dedo ao tocar já contaria como
    // arrasto e cancelaria o toque no card.
    if (!arrastou && Math.abs(dx) < LIMIAR) return;

    if (!arrastou) {
      arrastou = true;
      trilho.setPointerCapture(e.pointerId);
    }

    alvo = limitar(alvo0 - dx / PX_POR_CARD);
    animar();
  });

  function soltar() {
    if (!arrastando) return;
    arrastando = false;
    trilho.classList.remove("deslizando");
    alvo = limitar(Math.round(atual));
    animar();
  }

  trilho.addEventListener("pointerup", soltar);
  trilho.addEventListener("pointercancel", soltar);

  /* Tocar num card lateral traz ele pro centro (celular). */
  cards.forEach((card, i) => {
    card.addEventListener("click", (e) => {
      if (arrastou) {              // foi deslize, não toque
        e.preventDefault();
        return;
      }
      if (temHover) return;        // no desktop quem manda é o cursor
      if (Math.abs(distancia(i)) < 0.5) return;
      alvo = limitar(i);
      animar();
    });
  });

  window.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    alvo = limitar(Math.round(atual) + (e.key === "ArrowRight" ? 1 : -1));
    animar();
  });

  render();
})();

/* ---------------- Mural ---------------- */
(function () {
  const campo = document.getElementById("campo-post");
  const botao = document.getElementById("btn-publicar");
  const feed = document.getElementById("feed");
  if (!campo || !botao || !feed) return;

  const CHAVE = "mural-imersao-claude";

  /* O textarea cresce junto com o texto, em vez de virar uma
     caixinha com barra de rolagem interna. */
  function ajustarAltura() {
    campo.style.height = "auto";
    campo.style.height = campo.scrollHeight + "px";
  }

  function podePublicar() {
    return campo.value.trim().length > 0;
  }

  function atualizarBotao() {
    botao.disabled = !podePublicar();
  }

  /* Monta o card do post via DOM, nunca via innerHTML.
     Se alguém digitar "<script>", tem que aparecer como texto
     literal na tela — e não ser executado pelo navegador. */
  function criarPost(texto, quando) {
    const art = document.createElement("article");
    art.className = "post liquid-glass";

    const av = document.createElement("span");
    av.className = "avatar";
    av.textContent = "VC";

    const corpo = document.createElement("div");
    corpo.className = "post-corpo";

    const topo = document.createElement("div");
    topo.className = "post-topo";

    const nome = document.createElement("strong");
    nome.textContent = "Você";

    const hora = document.createElement("span");
    hora.className = "post-hora";
    hora.textContent = quando;

    topo.append(nome, hora);

    const p = document.createElement("p");
    p.textContent = texto;

    corpo.append(topo, p);
    art.append(av, corpo);
    return art;
  }

  function lerSalvos() {
    try {
      const bruto = localStorage.getItem(CHAVE);
      const lista = bruto ? JSON.parse(bruto) : [];
      return Array.isArray(lista) ? lista : [];
    } catch {
      // localStorage bloqueado (aba anônima, cookies off) ou JSON
      // corrompido: o mural degrada pro modo só-leitura em vez de
      // quebrar a página inteira.
      return [];
    }
  }

  function salvar(lista) {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(lista));
    } catch {
      /* sem espaço ou sem permissão — o post ainda aparece na tela */
    }
  }

  function publicar() {
    if (!podePublicar()) return;

    const texto = campo.value.trim();
    const agora = new Date().toLocaleString("pt-BR", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });

    feed.prepend(criarPost(texto, agora));

    const lista = lerSalvos();
    lista.unshift({ texto, quando: agora });
    salvar(lista.slice(0, 50));

    campo.value = "";
    ajustarAltura();
    atualizarBotao();
  }

  // Restaura o que a pessoa já tinha escrito antes
  lerSalvos().reverse().forEach((p) => feed.prepend(criarPost(p.texto, p.quando)));

  campo.addEventListener("input", () => { ajustarAltura(); atualizarBotao(); });
  botao.addEventListener("click", publicar);

  // Enter publica; Shift+Enter quebra linha.
  campo.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      publicar();
    }
  });

  atualizarBotao();
})();
