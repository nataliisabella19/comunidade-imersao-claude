/* ==========================================================
   Fundo: o asterisco da Claude formado por partículas.
   Canvas 2D puro — sem bibliotecas, sem build.

   Como funciona:
   1. Gera N pontos 3D distribuídos ao longo das hastes do
      asterisco, com uma espessura em Z (vira um "miolo", não
      uma chapa plana).
   2. As conexões são calculadas UMA VEZ. A figura é rígida e
      só rotaciona — rotação preserva distância, então os pares
      vizinhos nunca mudam. Recalcular a cada frame seria
      desperdiçar ~180 mil comparações por quadro.
   3. A cada frame só rotaciona, projeta e desenha.
   ========================================================== */

(function () {
  const canvas = document.getElementById("bg");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  /* ---------- Ajustes ---------- */
  const N_PONTOS   = 600;   // igual ao print de referência
  const HASTES     = 12;    // raios do asterisco
  const RAIO_INT   = 0.16;  // onde a haste começa (0 = centro)
  const RAIO_EXT   = 1.0;   // onde termina
  const ESPESSURA  = 0.055; // largura da haste na base
  const PROFUND    = 0.10;  // "miolo" em Z — dá volume ao girar
  /* Calibrado: 0.105 rende ~2234 conexões. O teto é só uma trava
     de segurança e fica bem acima disso de propósito — se ele
     cortasse, cortaria só o fim da lista, e um pedaço do asterisco
     ficaria sem conexão nenhuma. */
  const DIST_CONEX = 0.105;
  const MAX_CONEX  = 6000;

  /* Rotação limitada: o logo nunca fica de perfil, então
     continua legível como logo o tempo todo. */
  const AMPLITUDE_Y = 0.55; // ~32°
  const AMPLITUDE_X = 0.22; // ~13°

  const reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Ruído determinístico (sem Math.random) ----------
     Assim o fundo é idêntico em todo carregamento — nada de
     "às vezes fica feio". */
  let semente = 20260712;
  function rnd() {
    semente = (semente * 1664525 + 1013904223) % 4294967296;
    return semente / 4294967296;
  }

  /* ---------- 1. Gerar os pontos do asterisco ---------- */
  const pontos = [];
  for (let i = 0; i < N_PONTOS; i++) {
    const haste = i % HASTES;
    const ang = (haste / HASTES) * Math.PI * 2;

    // Distribuição enviesada pro miolo: mais denso no centro,
    // rarefeito nas pontas — como no print.
    const t = Math.pow(rnd(), 0.75);
    const r = RAIO_INT + t * (RAIO_EXT - RAIO_INT);

    // A haste afina conforme se afasta do centro.
    const largura = ESPESSURA * (1 - t * 0.75);
    const desvio = (rnd() - 0.5) * 2 * largura;

    const x = Math.cos(ang) * r - Math.sin(ang) * desvio;
    const y = Math.sin(ang) * r + Math.cos(ang) * desvio;
    const z = (rnd() - 0.5) * 2 * PROFUND;

    pontos.push({ x, y, z });
  }

  /* ---------- 2. Conexões: calculadas uma única vez ---------- */
  const conexoes = [];
  const d2 = DIST_CONEX * DIST_CONEX;
  for (let i = 0; i < pontos.length && conexoes.length < MAX_CONEX; i++) {
    for (let j = i + 1; j < pontos.length && conexoes.length < MAX_CONEX; j++) {
      const dx = pontos[i].x - pontos[j].x;
      const dy = pontos[i].y - pontos[j].y;
      const dz = pontos[i].z - pontos[j].z;
      if (dx * dx + dy * dy + dz * dz < d2) conexoes.push([i, j]);
    }
  }

  // Contador, igual ao do print
  const contador = document.getElementById("bg-contador");
  if (contador) {
    contador.textContent = `${pontos.length} entidades · ${conexoes.length} conexões`;
  }

  /* ---------- 3. Loop de render ---------- */
  let larg = 0, alt = 0, escala = 0, cx = 0, cy = 0;

  function redimensionar() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    larg = window.innerWidth;
    alt = window.innerHeight;
    canvas.width = larg * dpr;
    canvas.height = alt * dpr;
    canvas.style.width = larg + "px";
    canvas.style.height = alt + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // O asterisco ocupa ~38% da menor dimensão da tela.
    escala = Math.min(larg, alt) * 0.38;
    cx = larg / 2;
    cy = alt / 2;
  }

  /* ==========================================================
     INTERAÇÃO COM O CURSOR
     ========================================================== */

  const RAIO_CAMPO = 190;  // alcance da influência do mouse, em px
  const FORCA_EMPURRAO = 26; // quanto o nó é afastado, em px
  const SUAVIDADE = 0.055; // 0 = não segue; 1 = gruda no cursor

  // Alvo (pra onde o mouse quer levar) e atual (onde de fato está).
  // A diferença entre os dois é o que cria a sensação de peso/inércia.
  let alvoY = 0, alvoX = 0;
  let atualY = 0, atualX = 0;

  // Posição do cursor na tela. -1 = fora da tela (desliga o campo).
  let mx = -1, my = -1;
  let temCursor = false;

  function moverCursor(px, py) {
    mx = px;
    my = py;
    temCursor = true;

    // Normaliza pra -1..1 a partir do centro da tela
    const nx = (px / larg) * 2 - 1;
    const ny = (py / alt) * 2 - 1;

    alvoY = nx * AMPLITUDE_Y;
    alvoX = -ny * AMPLITUDE_X;
  }

  if (!reduzirMovimento) {
    window.addEventListener("pointermove", (e) => moverCursor(e.clientX, e.clientY), { passive: true });

    // Cursor saiu da janela: o campo desliga e o asterisco
    // volta suavemente pro giro ocioso.
    window.addEventListener("pointerleave", () => {
      temCursor = false;
      mx = my = -1;
    }, { passive: true });
  }

  /* ---------- Loop de render ---------- */
  const projX = new Float32Array(pontos.length);
  const projY = new Float32Array(pontos.length);
  const projP = new Float32Array(pontos.length);
  const projG = new Float32Array(pontos.length); // 0..1 — quão "aceso" pelo cursor

  const r2Campo = RAIO_CAMPO * RAIO_CAMPO;

  function desenhar(tempo) {
    const t = reduzirMovimento ? 0 : tempo * 0.00013;

    // Sem cursor, o asterisco respira sozinho. Com cursor, o mouse
    // manda — mas a transição entre os dois é contínua, então não
    // existe "solavanco" quando o mouse entra ou sai da tela.
    if (!temCursor) {
      alvoY = Math.sin(t) * AMPLITUDE_Y;
      alvoX = Math.sin(t * 0.7) * AMPLITUDE_X;
    }

    // Easing: persegue o alvo em vez de saltar até ele.
    atualY += (alvoY - atualY) * SUAVIDADE;
    atualX += (alvoX - atualX) * SUAVIDADE;

    const cosY = Math.cos(atualY), sinY = Math.sin(atualY);
    const cosX = Math.cos(atualX), sinX = Math.sin(atualX);

    ctx.clearRect(0, 0, larg, alt);

    // --- Projeta, aplica repulsão e calcula o brilho ---
    for (let i = 0; i < pontos.length; i++) {
      const p = pontos[i];

      const x1 = p.x * cosY + p.z * sinY;
      const z1 = -p.x * sinY + p.z * cosY;
      const y2 = p.y * cosX - z1 * sinX;
      const z2 = p.y * sinX + z1 * cosX;

      const persp = 2.6 / (2.6 - z2);
      let sx = cx + x1 * escala * persp;
      let sy = cy + y2 * escala * persp;
      let brilho = 0;

      if (temCursor) {
        const dx = sx - mx;
        const dy = sy - my;
        const d2p = dx * dx + dy * dy;

        if (d2p < r2Campo && d2p > 0.01) {
          const d = Math.sqrt(d2p);
          // Queda suave: 1 no cursor, 0 na borda do campo.
          const f = 1 - d / RAIO_CAMPO;
          const suave = f * f;

          // Empurra o nó pra longe do cursor, na direção radial.
          sx += (dx / d) * FORCA_EMPURRAO * suave;
          sy += (dy / d) * FORCA_EMPURRAO * suave;
          brilho = suave;
        }
      }

      projX[i] = sx;
      projY[i] = sy;
      projP[i] = persp;
      projG[i] = brilho;
    }

    // --- Conexões: duas passadas ---
    // Passada 1: a malha inteira, bem fraquinha.
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = "rgba(255,255,255,0.055)";
    ctx.beginPath();
    for (let k = 0; k < conexoes.length; k++) {
      const a = conexoes[k][0], b = conexoes[k][1];
      ctx.moveTo(projX[a], projY[a]);
      ctx.lineTo(projX[b], projY[b]);
    }
    ctx.stroke();

    // Passada 2: só o que está sob o cursor, aceso por cima.
    // É o que dá a leitura de "sinapse disparando".
    if (temCursor) {
      ctx.lineWidth = 0.85;
      for (let k = 0; k < conexoes.length; k++) {
        const a = conexoes[k][0], b = conexoes[k][1];
        const g = Math.max(projG[a], projG[b]);
        if (g < 0.02) continue;
        ctx.strokeStyle = `rgba(255,255,255,${0.055 + g * 0.4})`;
        ctx.beginPath();
        ctx.moveTo(projX[a], projY[a]);
        ctx.lineTo(projX[b], projY[b]);
        ctx.stroke();
      }
    }

    // --- Nós: profundidade + brilho do cursor ---
    for (let i = 0; i < pontos.length; i++) {
      const prox = Math.max(0, Math.min(1, (projP[i] - 0.85) / 0.6));
      const g = projG[i];

      const raio = 1.1 + prox * 1.9 + g * 2.2;
      const alpha = Math.min(1, 0.28 + prox * 0.55 + g * 0.5);

      ctx.beginPath();
      ctx.arc(projX[i], projY[i], raio, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fill();
    }

    if (!reduzirMovimento) requestAnimationFrame(desenhar);
  }

  window.addEventListener("resize", redimensionar);
  redimensionar();

  if (reduzirMovimento) desenhar(0);
  else requestAnimationFrame(desenhar);
})();
