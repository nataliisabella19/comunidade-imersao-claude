/* ==========================================================
   1. Carrossel — setas e estado dos botões
   2. Mural — compositor de posts

   ATENÇÃO (importante): o site é estático, sem servidor.
   Os posts são gravados no localStorage, ou seja, ficam SÓ no
   navegador de quem escreveu. Ninguém mais enxerga. É uma
   demonstração de interface, não uma comunidade funcionando.
   Pra virar um mural de verdade, precisa de um backend.
   ========================================================== */

/* ---------------- Carrossel: loop infinito + arrastar ---------------- */
(function () {
  const trilho = document.getElementById("trilho");
  if (!trilho) return;

  const setas = document.querySelectorAll(".seta");
  const originais = Array.from(trilho.children);
  if (!originais.length) return;

  /* ---------- Loop infinito ----------
     O truque: triplico os cards. O usuário sempre navega no bloco
     do MEIO. Quando ele encosta no bloco da esquerda ou da direita,
     eu teletransporto o scroll de volta pro meio — um salto exato
     de uma "volta" inteira, então visualmente nada muda. É por isso
     que a fita nunca "bate" no fim: ela não tem fim.

     Os clones são aria-hidden: pro leitor de tela, os cards
     continuam existindo uma vez só. */
  function clonar() {
    originais.forEach((el) => {
      const antes = el.cloneNode(true);
      const depois = el.cloneNode(true);
      antes.setAttribute("aria-hidden", "true");
      depois.setAttribute("aria-hidden", "true");
      trilho.prepend(antes);
      trilho.append(depois);
    });
  }

  // Largura de UMA volta (o conjunto original de cards + gaps)
  function voltaLarga() {
    return trilho.scrollWidth / 3;
  }

  // Salto instantâneo: precisa desligar o scroll suave e o encaixe,
  // senão o navegador anima o teletransporte e a costura fica visível.
  function saltar(delta) {
    const snap = trilho.style.scrollSnapType;
    trilho.style.scrollBehavior = "auto";
    trilho.style.scrollSnapType = "none";
    trilho.scrollLeft += delta;
    trilho.offsetHeight; // força o navegador a aplicar antes de religar
    trilho.style.scrollBehavior = "";
    trilho.style.scrollSnapType = snap;
  }

  function recentrar() {
    const volta = voltaLarga();
    if (trilho.scrollLeft < volta * 0.5) saltar(volta);
    else if (trilho.scrollLeft > volta * 1.5) saltar(-volta);
  }

  clonar();
  // Começa no bloco do meio
  requestAnimationFrame(() => saltar(voltaLarga()));

  trilho.addEventListener("scroll", () => {
    // Enquanto o dedo/mouse está arrastando, não recentro: o salto
    // no meio do gesto faria o card "escapar" da mão.
    if (!arrastando) recentrar();
  }, { passive: true });

  window.addEventListener("resize", recentrar);

  /* ---------- Setas ---------- */
  setas.forEach((btn) => {
    btn.addEventListener("click", () => {
      const dir = Number(btn.dataset.dir);
      trilho.scrollBy({ left: dir * trilho.clientWidth * 0.85, behavior: "smooth" });
    });
  });

  /* ---------- Arrastar com o cursor ---------- */
  let arrastando = false;
  let arrastou = false;   // diferencia um clique de um arrasto
  let x0 = 0;
  let scroll0 = 0;

  trilho.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    arrastando = true;
    arrastou = false;
    x0 = e.clientX;
    scroll0 = trilho.scrollLeft;
    trilho.classList.add("arrastando");
  });

  trilho.addEventListener("pointermove", (e) => {
    if (!arrastando) return;
    const dx = e.clientX - x0;

    // Só vira "arrasto" depois de 4px. Sem essa folga, o tremor
    // natural da mão ao clicar cancelaria o clique no card.
    if (Math.abs(dx) > 4) {
      arrastou = true;
      trilho.setPointerCapture(e.pointerId);
    }
    if (arrastou) trilho.scrollLeft = scroll0 - dx;
  });

  function soltar() {
    if (!arrastando) return;
    arrastando = false;
    trilho.classList.remove("arrastando");
    recentrar();
  }

  trilho.addEventListener("pointerup", soltar);
  trilho.addEventListener("pointercancel", soltar);

  // Se a pessoa arrastou, o "clique" que o navegador dispara no fim
  // do gesto não pode abrir o card.
  trilho.addEventListener("click", (e) => {
    if (arrastou) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
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
