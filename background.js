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

  const proj = new Array(pontos.length);

  function desenhar(tempo) {
    const t = reduzirMovimento ? 0 : tempo * 0.00013;
    const angY = Math.sin(t) * AMPLITUDE_Y;
    const angX = Math.sin(t * 0.7) * AMPLITUDE_X;

    const cosY = Math.cos(angY), sinY = Math.sin(angY);
    const cosX = Math.cos(angX), sinX = Math.sin(angX);

    ctx.clearRect(0, 0, larg, alt);

    // Projeta todos os pontos
    for (let i = 0; i < pontos.length; i++) {
      const p = pontos[i];

      // rotação em Y, depois em X
      const x1 = p.x * cosY + p.z * sinY;
      const z1 = -p.x * sinY + p.z * cosY;
      const y2 = p.y * cosX - z1 * sinX;
      const z2 = p.y * sinX + z1 * cosX;

      // perspectiva
      const persp = 2.6 / (2.6 - z2);
      proj[i] = {
        x: cx + x1 * escala * persp,
        y: cy + y2 * escala * persp,
        p: persp,
      };
    }

    // Conexões primeiro (ficam atrás dos nós)
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let k = 0; k < conexoes.length; k++) {
      const a = proj[conexoes[k][0]];
      const b = proj[conexoes[k][1]];
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.055)";
    ctx.stroke();

    // Nós — quem está mais perto da câmera fica maior e mais claro
    for (let i = 0; i < proj.length; i++) {
      const q = proj[i];
      const prox = (q.p - 0.85) / 0.6;          // ~0 (fundo) a ~1 (frente)
      const raio = 1.1 + Math.max(0, prox) * 1.9;
      const alpha = 0.28 + Math.max(0, Math.min(1, prox)) * 0.55;

      ctx.beginPath();
      ctx.arc(q.x, q.y, raio, 0, Math.PI * 2);
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
