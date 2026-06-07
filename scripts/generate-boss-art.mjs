import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outputDir = join(process.cwd(), 'public/assets/combat');

const bosses = [
  {
    id: 'briar-warden',
    palette: {
      dark: '#17120d',
      shade: '#2a1b16',
      mid: '#3d6f3a',
      bright: '#79b65d',
      gold: '#d3a85b',
      pale: '#f1dfad',
      glow: '#a8e07a'
    },
    body: ({ p }) => `
      <path d="M90 384 C100 296 104 232 92 160 C120 186 142 205 176 207 C210 205 232 186 260 160 C248 232 252 296 262 384 C236 408 207 420 176 420 C145 420 116 408 90 384 Z" fill="${p.shade}" stroke="${p.dark}" stroke-width="14"/>
      <path d="M122 370 C127 292 128 238 118 190 C139 206 157 216 176 216 C195 216 213 206 234 190 C224 238 225 292 230 370 C214 386 196 394 176 394 C156 394 138 386 122 370 Z" fill="${p.mid}" stroke="${p.dark}" stroke-width="8"/>
      <path d="M91 159 L61 112 L106 128 L116 74 L145 124 L176 54 L207 124 L236 74 L246 128 L291 112 L261 159" fill="${p.mid}" stroke="${p.dark}" stroke-width="12" stroke-linejoin="round"/>
      <path d="M112 144 L86 121 L123 133 L129 96 L151 132 L176 78 L201 132 L223 96 L229 133 L266 121 L240 144" fill="${p.bright}" stroke="${p.dark}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M136 236 L111 215 L128 265 L105 303" fill="none" stroke="${p.gold}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M216 236 L241 215 L224 265 L247 303" fill="none" stroke="${p.gold}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M146 170 L167 155 L188 170 L184 202 L168 216 L152 202 Z" fill="${p.dark}" stroke="${p.pale}" stroke-width="6"/>
      <path d="M154 176 L166 169 L178 176 L176 192 L166 201 L156 192 Z" fill="${p.glow}"/>
      <path d="M139 312 C157 298 195 298 213 312 L205 344 C188 334 164 334 147 344 Z" fill="${p.dark}" stroke="${p.gold}" stroke-width="5"/>
      <path d="M75 256 C43 238 40 205 63 180 M277 256 C309 238 312 205 289 180" fill="none" stroke="${p.mid}" stroke-width="15" stroke-linecap="round"/>
      <path d="M75 256 C43 238 40 205 63 180 M277 256 C309 238 312 205 289 180" fill="none" stroke="${p.bright}" stroke-width="7" stroke-linecap="round"/>
    `
  },
  {
    id: 'crown-sentinel',
    palette: {
      dark: '#16100e',
      shade: '#3b2430',
      mid: '#81513a',
      bright: '#d88a43',
      gold: '#f0c35c',
      pale: '#f6e7a5',
      glow: '#ff5a3d'
    },
    body: ({ p }) => `
      <path d="M101 395 L86 163 L130 187 L145 112 L176 178 L207 112 L222 187 L266 163 L251 395 C232 414 207 424 176 424 C145 424 120 414 101 395 Z" fill="${p.shade}" stroke="${p.dark}" stroke-width="14" stroke-linejoin="round"/>
      <path d="M128 374 L119 201 L147 217 L157 157 L176 214 L195 157 L205 217 L233 201 L224 374 C210 388 194 396 176 396 C158 396 142 388 128 374 Z" fill="${p.mid}" stroke="${p.dark}" stroke-width="8"/>
      <path d="M105 164 L75 118 L122 131 L135 78 L160 129 L176 50 L192 129 L217 78 L230 131 L277 118 L247 164 Z" fill="${p.gold}" stroke="${p.dark}" stroke-width="12" stroke-linejoin="round"/>
      <path d="M130 168 L104 135 L138 143 L148 107 L166 143 L176 82 L186 143 L204 107 L214 143 L248 135 L222 168" fill="${p.pale}" stroke="${p.dark}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M126 240 L226 240 L215 326 L137 326 Z" fill="${p.dark}" stroke="${p.gold}" stroke-width="7" stroke-linejoin="round"/>
      <path d="M150 222 L165 207 L187 207 L202 222 L196 255 L156 255 Z" fill="${p.glow}" stroke="${p.dark}" stroke-width="6"/>
      <path d="M162 272 H190 M154 294 H198" stroke="${p.pale}" stroke-width="8" stroke-linecap="square"/>
      <path d="M89 246 L43 216 L68 198 L111 224 M263 246 L309 216 L284 198 L241 224" fill="${p.mid}" stroke="${p.dark}" stroke-width="9" stroke-linejoin="round"/>
      <path d="M47 216 L31 187 M305 216 L321 187" stroke="${p.gold}" stroke-width="8" stroke-linecap="round"/>
    `
  },
  {
    id: 'loop-tyrant',
    palette: {
      dark: '#130f12',
      shade: '#211b2f',
      mid: '#5b345d',
      bright: '#9f3d35',
      gold: '#d2b15c',
      pale: '#efe0ac',
      glow: '#d95145'
    },
    body: ({ p }) => `
      <path d="M82 394 C101 310 111 238 94 153 C122 177 148 189 176 189 C204 189 230 177 258 153 C241 238 251 310 270 394 C244 420 213 433 176 433 C139 433 108 420 82 394 Z" fill="${p.shade}" stroke="${p.dark}" stroke-width="16"/>
      <path d="M115 374 C128 302 132 244 121 188 C139 202 158 210 176 210 C194 210 213 202 231 188 C220 244 224 302 237 374 C219 392 199 401 176 401 C153 401 133 392 115 374 Z" fill="${p.mid}" stroke="${p.dark}" stroke-width="8"/>
      <path d="M85 154 L55 99 L112 126 L124 66 L153 119 L176 39 L199 119 L228 66 L240 126 L297 99 L267 154" fill="${p.dark}" stroke="${p.gold}" stroke-width="10" stroke-linejoin="round"/>
      <path d="M126 165 L163 139 L176 92 L189 139 L226 165 L202 196 L150 196 Z" fill="${p.bright}" stroke="${p.dark}" stroke-width="8" stroke-linejoin="round"/>
      <path d="M154 174 L170 163 L182 163 L198 174 L190 198 L162 198 Z" fill="${p.glow}"/>
      <path d="M134 246 C150 232 202 232 218 246 L209 313 C195 299 157 299 143 313 Z" fill="${p.dark}" stroke="${p.gold}" stroke-width="7"/>
      <path d="M156 265 H196 M151 287 H201" stroke="${p.pale}" stroke-width="7" stroke-linecap="square"/>
      <path d="M94 255 C49 242 39 199 64 170 M258 255 C303 242 313 199 288 170" fill="none" stroke="${p.dark}" stroke-width="18" stroke-linecap="round"/>
      <path d="M94 255 C49 242 39 199 64 170 M258 255 C303 242 313 199 288 170" fill="none" stroke="${p.bright}" stroke-width="8" stroke-linecap="round"/>
      <path d="M64 170 L58 126 M288 170 L294 126" stroke="${p.gold}" stroke-width="8" stroke-linecap="round"/>
    `
  }
];

function svgForBoss(boss) {
  const p = boss.palette;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="352" height="472" viewBox="0 0 352 472" role="img" aria-label="${boss.id}">
  <rect width="352" height="472" fill="none"/>
  <ellipse cx="176" cy="421" rx="112" ry="26" fill="#060504" opacity=".52"/>
  <g shape-rendering="crispEdges">
    ${boss.body({ p })}
    <path d="M109 392 C132 425 220 425 243 392" fill="none" stroke="#f1dfad" stroke-width="5" opacity=".45"/>
    <path d="M86 405 H266" stroke="#050403" stroke-width="8" opacity=".58"/>
  </g>
</svg>
`;
}

mkdirSync(outputDir, { recursive: true });
for (const boss of bosses) {
  writeFileSync(join(outputDir, `enemy-${boss.id}.svg`), svgForBoss(boss));
}

console.log(`Generated ${bosses.length} boss art assets in ${outputDir}`);
