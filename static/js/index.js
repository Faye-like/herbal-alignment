/* 首页：沉浸式氛围序章 —— 视差 / 文字渐显 / 鼠标光斑 / 粒子 / 阻尼滚动 */
injectNav('/', false);
injectFooter();

(function () {
  'use strict';

  /* ---------- 1. 逐词淡入：导语文字 ---------- */
  function animateWords() {
    const words = document.querySelectorAll('.im-word');
    words.forEach((w, i) => {
      w.style.animation = `imLineIn .7s cubic-bezier(.22,.61,.36,1) ${0.9 + i * 0.05}s forwards`;
    });
  }

  /* ---------- 2. 鼠标跟随环境光斑 ---------- */
  const cursorLight = document.getElementById('cursorLight');
  let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
  let lightX = mouseX, lightY = mouseY;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX; mouseY = e.clientY;
  });

  function updateCursorLight() {
    lightX += (mouseX - lightX) * 0.06;
    lightY += (mouseY - lightY) * 0.06;
    if (cursorLight) {
      cursorLight.style.transform = `translate(${lightX}px, ${lightY}px) translate(-50%, -50%)`;
    }
    requestAnimationFrame(updateCursorLight);
  }
  updateCursorLight();

  /* ---------- 3. 视差滚动 + 导语透明度随滚动隐去 ---------- */
  const bgLayers = document.querySelectorAll('.im-bg');
  const hero = document.querySelector('.im-hero');
  const decorItems = document.querySelectorAll('.im-decor-item');

  function onScroll() {
    const scrollY = window.scrollY || window.pageYOffset;
    const winH = window.innerHeight;

    // 背景层视差（不同速率）
    bgLayers.forEach(layer => {
      const speed = parseFloat(layer.dataset.parallax) || 0.1;
      layer.style.transform = `translate3d(0, ${scrollY * speed}px, 0)`;
    });

    // 装饰元素轻微反向视差
    decorItems.forEach((item, i) => {
      const speed = 0.04 + (i % 3) * 0.02;
      item.style.setProperty('--py', `${scrollY * speed}px`);
    });

    // 导语透明度随滚动柔和隐去
    if (hero) {
      const heroRect = hero.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -heroRect.top / winH));
      const opacity = 1 - progress * 1.1;
      hero.style.opacity = opacity > 0 ? opacity : 0;
      hero.style.transform = `translateY(${scrollY * 0.15}px)`;
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- 4. 滚动粒子（花瓣 / 气泡） ---------- */
  const canvas = document.getElementById('particleCanvas');
  const ctx = canvas ? canvas.getContext('2d') : null;
  let particles = [];
  const PARTICLE_COUNT = 28;

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  function createParticle() {
    const isPetal = Math.random() > 0.45;
    return {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: isPetal ? (3 + Math.random() * 4) : (2 + Math.random() * 5),
      vx: (Math.random() - 0.5) * 0.3,
      vy: -(0.2 + Math.random() * 0.5),
      drift: Math.random() * Math.PI * 2,
      driftSpeed: 0.005 + Math.random() * 0.01,
      opacity: 0.15 + Math.random() * 0.4,
      hue: isPetal ? (140 + Math.random() * 40) : (190 + Math.random() * 30),
      type: isPetal ? 'petal' : 'bubble',
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.02
    };
  }

  function initParticles() {
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(createParticle());
  }
  initParticles();

  function drawParticles() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scrollY = window.scrollY || 0;

    particles.forEach(p => {
      p.drift += p.driftSpeed;
      p.x += p.vx + Math.sin(p.drift) * 0.4;
      p.y += p.vy - scrollY * 0.0008; // 随滚动缓慢上浮
      p.rot += p.vrot;

      // 到达边界柔和淡出并重置
      if (p.y < -20 || p.x < -30 || p.x > canvas.width + 30) {
        p.opacity -= 0.02;
        if (p.opacity <= 0) {
          Object.assign(p, createParticle(), { y: canvas.height + 20, opacity: 0 });
        }
      } else {
        if (p.opacity < (p.type === 'petal' ? 0.35 : 0.4)) p.opacity += 0.01;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.opacity));
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);

      if (p.type === 'petal') {
        // 花瓣：椭圆 + 渐隐
        ctx.fillStyle = `hsla(${p.hue}, 45%, 70%, 1)`;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 气泡：空心圆
        ctx.strokeStyle = `hsla(${p.hue}, 50%, 75%, 1)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    });
    requestAnimationFrame(drawParticles);
  }
  drawParticles();

  /* ---------- 5. 阻尼平滑滚动 ---------- */
  let targetScroll = window.scrollY;
  let currentScroll = window.scrollY;
  let isSmoothing = false;

  // 监听滚轮目标
  window.addEventListener('wheel', (e) => {
    targetScroll += e.deltaY;
    targetScroll = Math.max(0, Math.min(targetScroll, document.body.scrollHeight - window.innerHeight));
    if (!isSmoothing) {
      isSmoothing = true;
      smoothLoop();
    }
  }, { passive: true });

  function smoothLoop() {
    currentScroll += (targetScroll - currentScroll) * 0.12;
    if (Math.abs(targetScroll - currentScroll) < 0.5) {
      currentScroll = targetScroll;
      isSmoothing = false;
      return;
    }
    window.scrollTo(0, currentScroll);
    requestAnimationFrame(smoothLoop);
  }

  /* ---------- 启动 ---------- */
  animateWords();
  onScroll();
})();
