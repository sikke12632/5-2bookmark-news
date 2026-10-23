// 그림: 창밖 마을, 기자 얼굴 (모두 코드로 그린 SVG)
window.ART = (() => {
  // 창밖 책갈피 마을 (620 × 214)
  function village() {
    const houses = [
      // x, 지붕색, 벽색, 크기
      [30, '#d9634f', '#f6e7cf', 1.0],
      [110, '#4f7fb5', '#fff3dc', 0.85],
      [172, '#c8873a', '#fbeedd', 0.7],
      [508, '#7a9a4a', '#f3e0c2', 0.85],
      [562, '#9a5fa8', '#f6e7cf', 0.95],
    ];
    const h = houses.map(([x, roof, wall, s]) => `
      <g transform="translate(${x} ${150 - 40 * s}) scale(${s})">
        <rect x="0" y="22" width="52" height="40" rx="3" fill="${wall}"/>
        <path d="M-6 24 L26 0 L58 24 Z" fill="${roof}"/>
        <rect x="8" y="34" width="12" height="12" rx="2" fill="#ffd77a"/>
        <rect x="30" y="38" width="12" height="24" rx="2" fill="#8a5a3a"/>
      </g>`).join('');
    return `<svg viewBox="0 0 620 214" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop class="sky1" offset="0" stop-color="#8fd0f0"/>
          <stop class="sky2" offset="1" stop-color="#dff3f6"/>
        </linearGradient>
      </defs>
      <rect width="620" height="214" fill="url(#sky)"/>
      <circle class="sun" cx="540" cy="46" r="22" fill="#ffe08a"/>
      <g class="cloud c1"><ellipse cx="90" cy="40" rx="34" ry="12" fill="#fff"/><ellipse cx="112" cy="32" rx="20" ry="12" fill="#fff"/></g>
      <g class="cloud c2"><ellipse cx="330" cy="28" rx="28" ry="10" fill="#fff"/><ellipse cx="346" cy="22" rx="16" ry="9" fill="#fff"/></g>
      <path d="M0 140 Q110 92 220 128 T440 118 T620 126 L620 214 L0 214 Z" fill="#a9d18e"/>
      <path d="M0 168 Q160 140 320 164 T620 158 L620 214 L0 214 Z" fill="#8cc070"/>
      <path d="M250 214 Q290 180 330 170 T400 150 L420 152 Q370 170 350 214 Z" fill="#7cc4e4" opacity=".9"/>
      ${h}
      <!-- 흥부네 지붕 위 박 -->
      <circle cx="48" cy="114" r="7" fill="#fbf7ea" stroke="#d8cfa8"/><circle cx="62" cy="118" r="6" fill="#fbf7ea" stroke="#d8cfa8"/>
      <!-- 책 모양 시계탑 (기자 얼굴에 가리지 않게 오른쪽에) -->
      <g transform="translate(428 46)">
        <rect x="0" y="0" width="70" height="100" rx="4" fill="#c0563f"/>
        <rect x="6" y="0" width="58" height="100" fill="#f4ead2"/>
        <rect x="0" y="0" width="8" height="100" rx="3" fill="#a3402e"/>
        <path d="M46 0 h12 v40 l-6 -6 l-6 6 Z" fill="#2f7f6f"/>
        <circle cx="35" cy="54" r="17" fill="#fff" stroke="#5a3a28" stroke-width="3"/>
        <path d="M35 54 V43 M35 54 L43 58" stroke="#5a3a28" stroke-width="2.5" stroke-linecap="round"/>
        <rect x="-8" y="100" width="86" height="10" rx="2" fill="#8a5a3a"/>
      </g>
      <!-- 작은 구름 택시 -->
      <g class="cloud c3"><ellipse cx="200" cy="70" rx="18" ry="7" fill="#fff6c8"/><circle cx="200" cy="60" r="5" fill="#e6a16b"/></g>
      <g fill="#5e9a4e"><circle cx="20" cy="150" r="14"/><circle cx="215" cy="152" r="12"/><circle cx="600" cy="150" r="16"/><circle cx="372" cy="146" r="10"/></g>
    </svg>`;
  }

  // 기자 얼굴 (200 × 220)
  const LOOKS = {
    hdj: { skin: '#f6cfa8', hair: '#e07a2e', shirt: '#4e9a6a', collar: '#fff4dc' },
    sgi: { skin: '#f3d1b4', hair: '#3b2a3e', shirt: '#8a62b0', collar: '#f6e9ff' },
  };
  function reporter(id) {
    const L = LOOKS[id];
    const body = `
      <path d="M30 220 Q30 160 100 152 Q170 160 170 220 Z" fill="${L.shirt}"/>
      <path d="M78 156 L100 182 L122 156 Z" fill="${L.collar}"/>
      <rect x="112" y="176" width="34" height="20" rx="3" fill="#fff" stroke="#c9b48a"/>
      <text x="129" y="191" font-size="12" text-anchor="middle" fill="#a3402e" font-family="JKTitle, serif">기자</text>
      <rect x="88" y="138" width="24" height="20" rx="8" fill="${L.skin}"/>`;
    const face = `
      <ellipse cx="100" cy="98" rx="50" ry="52" fill="${L.skin}"/>
      <ellipse cx="78" cy="104" rx="5" ry="6.5" fill="#2a211b"/><ellipse cx="122" cy="104" rx="5" ry="6.5" fill="#2a211b"/>
      <circle cx="80" cy="102" r="1.8" fill="#fff"/><circle cx="124" cy="102" r="1.8" fill="#fff"/>
      <ellipse cx="66" cy="120" rx="9" ry="5" fill="#f2a08f" opacity=".6"/><ellipse cx="134" cy="120" rx="9" ry="5" fill="#f2a08f" opacity=".6"/>`;
    if (id === 'hdj') {
      return `<svg viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg">${body}${face}
        <path d="M52 92 L46 60 L64 72 L66 44 L84 64 L96 38 L106 62 L124 42 L126 66 L146 54 L142 84 L154 92 Q150 54 100 46 Q52 50 52 92 Z" fill="${L.hair}"/>
        <path d="M88 126 Q100 134 112 126" stroke="#7a3b2a" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <rect x="140" y="62" width="8" height="46" rx="2" fill="#f2c84b" transform="rotate(24 144 85)"/>
        <path d="M156 100 l4 -3 l-2 10 Z" fill="#555" transform="rotate(24 144 85)"/>
        <path class="sweat" d="M160 92 Q166 104 160 110 Q154 104 160 92 Z" fill="#9fd6f2"/>
      </svg>`;
    }
    return `<svg viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg">${body}${face}
      <path d="M48 116 Q40 56 100 46 Q160 56 152 116 L142 116 Q140 76 100 70 Q64 74 58 116 Z" fill="${L.hair}"/>
      <circle cx="78" cy="104" r="13" fill="none" stroke="#3a3a3a" stroke-width="3"/><circle cx="122" cy="104" r="13" fill="none" stroke="#3a3a3a" stroke-width="3"/>
      <path d="M91 104 H109" stroke="#3a3a3a" stroke-width="3"/>
      <ellipse cx="100" cy="128" rx="6" ry="4" fill="#7a3b2a"/>
      <g transform="translate(118 116) rotate(-12)"><ellipse cx="10" cy="14" rx="14" ry="18" fill="${L.skin}" stroke="#d9a989" stroke-width="2"/></g>
    </svg>`;
  }

  return { village, reporter };
})();
