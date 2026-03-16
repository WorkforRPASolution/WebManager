<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useTheme } from '@/shared/composables/useTheme'

const { isDark } = useTheme()

const phase = ref(0)
const skipped = ref(false)
const animationComplete = ref(false)

const SESSION_KEY = 'ears-intro-played'
const alreadyPlayed = sessionStorage.getItem(SESSION_KEY) === 'true'

// Word definitions
const wordDefs = [
  { text: 'Equipment', acronymAt: 0 },
  { text: 'Automation', acronymAt: 0 },
  { text: 'And', acronymAt: null, cls: 'connector' },
  { text: 'Recovery', acronymAt: 0 },
  { text: 'System', acronymAt: 0 },
]

const words = wordDefs.map(w => ({
  cls: w.cls || '',
  letters: w.text.split('').map((ch, i) => ({
    ch,
    isAcronym: i === w.acronymAt && w.acronymAt !== null
  }))
}))

const lettersIn = reactive({})

function revealWord(wi, baseDelay = 0) {
  words[wi].letters.forEach((_, li) => {
    schedule(() => { lettersIn[wi * 100 + li] = true }, baseDelay + li * 42)
  })
}

// Timer management
const timers = []
function schedule(fn, delay) {
  const id = setTimeout(fn, delay)
  timers.push(id)
  return id
}
function clearTimers() {
  timers.forEach(clearTimeout)
  timers.length = 0
}

// Skip
function skipToEnd() {
  if (animationComplete.value) return
  clearTimers()
  skipped.value = true
  phase.value = 7
  animationComplete.value = true
  sessionStorage.setItem(SESSION_KEY, 'true')
  setTimeout(focusUsername, 300)
}

function focusUsername() {
  const input = document.querySelector('.landing-right-panel input[type="text"]')
  if (input) input.focus()
}

function handleKeydown(e) {
  if ((e.key === 'Enter' || e.key === 'Escape') && !animationComplete.value) {
    skipToEnd()
  }
}

function handleClick(e) {
  if (animationComplete.value || phase.value < 1) return
  if (e.target.closest('.landing-right-panel')) return
  skipToEnd()
}

const showForm = computed(() => phase.value >= 6 || skipped.value)

// Animation sequence
function runFullAnimation() {
  schedule(() => {
    phase.value = 1
    const gaps = [0, 280, 560, 820, 1100]
    gaps.forEach((d, wi) => schedule(() => revealWord(wi), d))
  }, 600)
  schedule(() => { phase.value = 2 }, 3600)
  schedule(() => { phase.value = 3 }, 4400)
  schedule(() => { phase.value = 35 }, 5400)
  schedule(() => { phase.value = 4 }, 5900)
  schedule(() => { phase.value = 5 }, 7000)
  schedule(() => { phase.value = 6 }, 8000)
  schedule(() => {
    phase.value = 7
    animationComplete.value = true
    sessionStorage.setItem(SESSION_KEY, 'true')
  }, 9800)
  schedule(() => focusUsername(), 10000)
}

function runShortAnimation() {
  skipped.value = true
  phase.value = 7
  setTimeout(() => {
    animationComplete.value = true
    focusUsername()
  }, 800)
}

// Font loading
function loadFonts() {
  if (document.getElementById('ears-landing-fonts')) return
  const pc = document.createElement('link')
  pc.rel = 'preconnect'
  pc.href = 'https://fonts.googleapis.com'
  document.head.appendChild(pc)
  const pc2 = document.createElement('link')
  pc2.rel = 'preconnect'
  pc2.href = 'https://fonts.gstatic.com'
  pc2.crossOrigin = ''
  document.head.appendChild(pc2)
  const link = document.createElement('link')
  link.id = 'ears-landing-fonts'
  link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Rajdhani:wght@300;400;500;600;700&family=Share+Tech+Mono&display=swap'
  document.head.appendChild(link)
}

onMounted(() => {
  loadFonts()
  window.addEventListener('keydown', handleKeydown)
  if (alreadyPlayed) {
    runShortAnimation()
  } else {
    runFullAnimation()
  }
})

onUnmounted(() => {
  clearTimers()
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div
    class="landing-root"
    :class="{
      'is-dark': isDark,
      'is-light': !isDark,
      'phase-split': phase >= 6,
      'phase-final': phase >= 7,
      'was-skipped': skipped
    }"
    @click="handleClick"
  >
    <!-- Sci-fi background effects -->
    <template v-if="!skipped">
      <div class="landing-scanline" :class="{ 'fade-out': phase >= 6 }"></div>
      <div class="landing-glow-orb" :class="{ 'fade-out': phase >= 6 }"></div>
      <div class="landing-corner landing-corner-tl" :class="{ in: phase >= 5, 'fade-out': phase >= 6 }"></div>
      <div class="landing-corner landing-corner-tr" :class="{ in: phase >= 5, 'fade-out': phase >= 6 }"></div>
      <div class="landing-corner landing-corner-bl" :class="{ in: phase >= 5, 'fade-out': phase >= 6 }"></div>
      <div class="landing-corner landing-corner-br" :class="{ in: phase >= 5, 'fade-out': phase >= 6 }"></div>
    </template>

    <div class="landing-grid-bg"></div>

    <!-- Main split container -->
    <div class="landing-split">
      <!-- Left panel: EARS branding -->
      <div class="landing-left-panel">
        <!-- Phase 1-3: Full phrase -->
        <div
          v-if="!skipped"
          v-show="phase < 4"
          class="landing-phrase-wrap"
          :class="{ imploding: phase >= 35 }"
        >
          <div class="landing-words-row">
            <span
              v-for="(word, wi) in words"
              :key="wi"
              class="landing-word"
              :class="word.cls"
            >
              <span
                v-for="(letter, li) in word.letters"
                :key="li"
                class="landing-letter"
                :class="{
                  in: lettersIn[wi * 100 + li],
                  acronym: letter.isAcronym,
                  dissolving: phase >= 3 && !letter.isAcronym,
                  charging: phase >= 35 && letter.isAcronym
                }"
                :style="{
                  transitionDelay: phase >= 3 && !letter.isAcronym
                    ? (li * 0.04 + wi * 0.02) + 's'
                    : '0s'
                }"
              >{{ letter.ch }}</span>
            </span>
          </div>
        </div>

        <!-- Phase 4+: EARS display -->
        <div
          v-show="phase >= 4 || skipped"
          class="landing-ears-stage"
          :class="{
            burst: phase >= 4 || skipped,
            glitching: phase === 4,
            solid: phase >= 5 || skipped
          }"
        >
          <div class="landing-ears-letters">
            <span class="landing-ears-char">E</span>
            <span class="landing-ears-char">A</span>
            <span class="landing-ears-char">R</span>
            <span class="landing-ears-char">S</span>
            <div v-if="phase === 4" class="landing-ears-glitch" aria-hidden="true">EARS</div>
          </div>
          <div class="landing-tagline" :class="{ in: phase >= 5 || skipped }">
            Equipment Automation &amp; Recovery System
          </div>
        </div>
      </div>

      <!-- Right panel: Login form -->
      <div class="landing-right-panel" :class="{ show: showForm }">
        <div class="landing-right-content">
          <slot />
        </div>
      </div>
    </div>

    <!-- Skip hint -->
    <div v-if="!animationComplete && !skipped && phase >= 1" class="landing-skip-hint">
      Press Enter or click to skip
    </div>
  </div>
</template>

<style>
/* ═══════════════════════════════════════════════════
   LANDING LAYOUT — EARS Intro + Split Login
   ═══════════════════════════════════════════════════ */

/* ── ROOT ── */
.landing-root {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: #050810;
  cursor: default;
  transition: background 1.2s ease 0.5s;
}
.landing-root.phase-split.is-dark { background: #0f172a; }
.landing-root.phase-split.is-light { background: #f3f4f6; }

/* Skipped: instant state + fade-in */
.landing-root.was-skipped {
  animation: landingFadeIn 0.8s ease forwards;
}
.landing-root.was-skipped,
.landing-root.was-skipped .landing-left-panel,
.landing-root.was-skipped .landing-right-panel,
.landing-root.was-skipped .landing-ears-letters,
.landing-root.was-skipped .landing-ears-char,
.landing-root.was-skipped .landing-ears-stage,
.landing-root.was-skipped .landing-tagline,
.landing-root.was-skipped .landing-grid-bg {
  transition-duration: 0s !important;
  transition-delay: 0s !important;
}

@keyframes landingFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* ── BACKGROUND EFFECTS ── */
.landing-grid-bg {
  position: fixed; inset: 0;
  background-image:
    linear-gradient(rgba(0,229,255,0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,229,255,0.035) 1px, transparent 1px);
  background-size: 60px 60px;
  pointer-events: none; z-index: 0;
  transition: opacity 0.8s ease;
}
.landing-root.phase-split .landing-grid-bg { opacity: 0; }

.landing-glow-orb {
  position: fixed;
  width: 800px; height: 800px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(0,229,255,0.06) 0%, transparent 68%);
  top: 50%; left: 50%;
  transform: translate(-50%,-50%);
  pointer-events: none; z-index: 0;
  opacity: 0.6;
  transition: opacity 0.8s ease;
}
.landing-glow-orb.fade-out { opacity: 0; }

.landing-scanline {
  position: fixed; inset: 0;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0px, transparent 3px,
    rgba(0,0,0,0.12) 3px, rgba(0,0,0,0.12) 4px
  );
  pointer-events: none; z-index: 1000;
  opacity: 0.4;
  transition: opacity 0.8s ease;
}
.landing-scanline.fade-out { opacity: 0; }

.landing-corner {
  position: fixed;
  width: 32px; height: 32px;
  z-index: 5;
  opacity: 0;
  transition: opacity 0.8s ease;
}
.landing-corner.in { opacity: 0.5; }
.landing-corner.fade-out { opacity: 0 !important; }
.landing-corner-tl { top: 20px; left: 20px; border-top: 1px solid #00e5ff; border-left: 1px solid #00e5ff; }
.landing-corner-tr { top: 20px; right: 20px; border-top: 1px solid #00e5ff; border-right: 1px solid #00e5ff; }
.landing-corner-bl { bottom: 20px; left: 20px; border-bottom: 1px solid #00e5ff; border-left: 1px solid #00e5ff; }
.landing-corner-br { bottom: 20px; right: 20px; border-bottom: 1px solid #00e5ff; border-right: 1px solid #00e5ff; }

/* ── SPLIT LAYOUT ── */
.landing-split {
  position: relative; z-index: 1;
  display: flex;
  width: 100%; height: 100%;
}

.landing-left-panel {
  width: 100%;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: width 1s cubic-bezier(0.4,0,0.2,1) 0.5s,
              background 1.2s ease 0.5s;
}
.landing-root.phase-split .landing-left-panel { width: 42%; }
.landing-root.phase-split.is-dark .landing-left-panel {
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
}
.landing-root.phase-split.is-light .landing-left-panel {
  background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
}

/* Left panel subtle grid (final) */
.landing-root.phase-final .landing-left-panel::after {
  content: '';
  position: absolute; inset: 0;
  pointer-events: none;
  opacity: 0;
  animation: landingSubtleGrid 0.8s ease 0.3s forwards;
}
.landing-root.phase-final.is-dark .landing-left-panel::after {
  background-image:
    linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px);
  background-size: 60px 60px;
}
.landing-root.phase-final.is-light .landing-left-panel::after {
  background-image:
    linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
  background-size: 60px 60px;
}
@keyframes landingSubtleGrid {
  to { opacity: 1; }
}

/* Right panel */
.landing-right-panel {
  width: 0;
  flex-shrink: 0;
  opacity: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: width 1s cubic-bezier(0.4,0,0.2,1) 0.5s,
              opacity 0.8s ease 1s;
}
.landing-right-panel.show {
  width: 58%;
  opacity: 1;
}
.landing-root.is-dark .landing-right-panel { background: #0f172a; }
.landing-root.is-light .landing-right-panel { background: #f3f4f6; }

.landing-right-content {
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 2rem;
}

/* ── PHRASE ANIMATION (Phase 1-3) ── */
.landing-phrase-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: opacity 0.5s ease, transform 0.5s ease;
}
.landing-phrase-wrap.imploding {
  opacity: 0;
  transform: scale(0.85);
}
.landing-words-row {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.45em;
  flex-wrap: wrap;
  padding: 0 1rem;
}
.landing-word {
  display: inline-flex;
  align-items: baseline;
  overflow: hidden;
}
.landing-letter {
  display: inline-block;
  font-family: 'Rajdhani', sans-serif;
  font-weight: 700;
  font-size: clamp(1.8rem, 4.5vw, 3.8rem);
  color: #c8d8e8;
  opacity: 0;
  transform: translateY(28px);
  transition:
    opacity 0.45s ease,
    transform 0.45s ease,
    color 0.4s ease,
    text-shadow 0.4s ease,
    max-width 0.5s ease,
    padding 0.5s ease;
  max-width: 2ch;
  overflow: hidden;
  white-space: nowrap;
}
.landing-letter.in { opacity: 1; transform: translateY(0); }
.landing-letter.acronym {
  color: #00e5ff;
  text-shadow: 0 0 18px rgba(0,229,255,0.55);
}
.landing-letter.dissolving {
  opacity: 0 !important;
  transform: translateY(-16px) scale(0.4) !important;
  max-width: 0 !important;
  padding: 0 !important;
}
.landing-letter.charging {
  color: white !important;
  text-shadow:
    0 0 10px #00e5ff,
    0 0 30px #00e5ff,
    0 0 60px rgba(0,229,255,0.6) !important;
  animation: landingChargeFlicker 0.15s infinite alternate;
}
@keyframes landingChargeFlicker {
  from { opacity: 1; }
  to { opacity: 0.7; }
}
.connector .landing-letter {
  color: #3a5060;
  font-weight: 300;
  font-size: clamp(1.2rem, 3vw, 2.5rem);
}

/* ── EARS DISPLAY (Phase 4+) ── */
.landing-ears-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  opacity: 0;
  transform: scale(0.25) translateY(40px);
  transition: opacity 0.8s cubic-bezier(0.34,1.56,0.64,1),
              transform 0.8s cubic-bezier(0.34,1.56,0.64,1);
  pointer-events: none;
}
.landing-ears-stage.burst {
  opacity: 1;
  transform: scale(1) translateY(0);
  pointer-events: auto;
}

.landing-ears-letters {
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(7rem, 20vw, 17rem);
  letter-spacing: 0.12em;
  line-height: 0.9;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: font-size 1s cubic-bezier(0.4,0,0.2,1) 0.5s;
}
.landing-root.phase-split .landing-ears-letters {
  font-size: clamp(3.5rem, 8vw, 6rem);
}

.landing-ears-char {
  display: inline-block;
  color: transparent;
  -webkit-text-stroke: 2px #00e5ff;
  transition: color 0.6s ease,
              -webkit-text-stroke 0.6s ease,
              text-shadow 0.6s ease;
}
.landing-ears-stage.solid .landing-ears-char {
  color: #00e5ff;
  -webkit-text-stroke: 0 transparent;
  text-shadow: 0 0 60px rgba(0,229,255,0.4), 0 0 120px rgba(0,229,255,0.15);
}

/* Phase 6: EARS color → theme */
.landing-root.phase-split .landing-ears-stage.solid .landing-ears-char {
  transition: color 1.2s ease 0.5s,
              -webkit-text-stroke 1.2s ease 0.5s,
              text-shadow 1.2s ease 0.5s;
}
.landing-root.phase-split.is-dark .landing-ears-stage.solid .landing-ears-char {
  color: #60a5fa;
  text-shadow: 0 0 30px rgba(96,165,250,0.2);
}
.landing-root.phase-split.is-light .landing-ears-stage.solid .landing-ears-char {
  color: #ffffff;
  text-shadow: 0 0 30px rgba(255,255,255,0.15);
}

/* Glitch */
.landing-ears-glitch {
  position: absolute; inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Bebas Neue', sans-serif;
  font-size: inherit;
  letter-spacing: 0.12em;
  line-height: 0.9;
  color: #ff3355;
  opacity: 0;
  pointer-events: none;
  clip-path: inset(50% 0 0 0);
}
.landing-ears-stage.glitching .landing-ears-glitch {
  animation: landingGlitch 0.5s steps(2) forwards;
}
@keyframes landingGlitch {
  0%   { opacity: 0.8; clip-path: inset(0% 0 80% 0); transform: translate(-3px, 0); }
  20%  { opacity: 0.6; clip-path: inset(50% 0 10% 0); transform: translate(3px, 0); }
  40%  { opacity: 0.8; clip-path: inset(20% 0 60% 0); transform: translate(-2px, 0); }
  60%  { opacity: 0.4; clip-path: inset(70% 0 5%  0); transform: translate(2px, 0); }
  80%  { opacity: 0.6; clip-path: inset(10% 0 40% 0); transform: translate(-1px, 0); }
  100% { opacity: 0;   clip-path: inset(100% 0 0 0); transform: translate(0, 0); }
}

/* ── TAGLINE ── */
.landing-tagline {
  font-family: 'Share Tech Mono', monospace;
  font-size: clamp(0.65rem, 1.4vw, 0.9rem);
  letter-spacing: 0.45em;
  color: #ff8c00;
  text-transform: uppercase;
  margin-top: 1.2rem;
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 0.8s ease 0.2s,
              transform 0.8s ease 0.2s,
              color 1s ease,
              font-size 1s ease;
  text-align: center;
  padding: 0 1rem;
}
.landing-tagline.in {
  opacity: 1;
  transform: translateY(0);
}

/* Phase 6: tagline shrink + recolor */
.landing-root.phase-split .landing-tagline {
  font-size: clamp(0.5rem, 1vw, 0.75rem);
  transition: opacity 0.8s ease 0.2s,
              transform 0.8s ease 0.2s,
              color 1s ease 0.7s,
              font-size 1s ease 0.5s;
}
.landing-root.phase-split.is-dark .landing-tagline.in { color: #94a3b8; }
.landing-root.phase-split.is-light .landing-tagline.in { color: rgba(255,255,255,0.6); }

/* ── SKIP HINT ── */
.landing-skip-hint {
  position: fixed;
  bottom: 20px; right: 24px;
  z-index: 100;
  font-family: 'Share Tech Mono', monospace;
  font-size: 0.7rem;
  color: rgba(255,255,255,0.25);
  letter-spacing: 0.1em;
  opacity: 0;
  animation: landingHintIn 1s ease 2s forwards;
}
@keyframes landingHintIn {
  to { opacity: 1; }
}

/* ── RESPONSIVE ── */
@media (max-width: 767px) {
  .landing-root.phase-split .landing-left-panel {
    display: none;
  }
  .landing-right-panel.show {
    width: 100% !important;
  }
}
</style>
