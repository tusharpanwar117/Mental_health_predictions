/* ==========================================================================
   Daylight
   Everything the page does. Plain JavaScript, no build step.
   ========================================================================== */

/* --------------------------------------------------------------------------
   CONFIG — the only line to change when the service moves
   -------------------------------------------------------------------------- */
const API_BASE = 'http://127.0.0.1:8000'

/* --------------------------------------------------------------------------
   Constants
   -------------------------------------------------------------------------- */

const $ = (id) => document.getElementById(id)
const form = $('check-form')

/* Values that must be sent as numbers rather than text. */
const NUMERIC = [
  'age',
  'avg_daily_usage_hours',
  'daily_unlocks',
  'study_hours',
  'physical_activity_hours',
  'sleep_hours_per_night',
]

/* Which answers each step must have before you can move on. */
const REQUIRED_BY_STEP = {
  1: ['country', 'gender', 'academic_level'],
  2: ['most_used_platform', 'purpose_of_use'],
  3: ['stress_level'],
}

/* The four things that share one 24-hour day. */
const DAY_PARTS = [
  { name: 'sleep_hours_per_night', label: 'Sleep', color: '#8e8cc9' },
  { name: 'study_hours', label: 'Study', color: '#4e9e85' },
  { name: 'avg_daily_usage_hours', label: 'Phone', color: '#dda44c' },
  { name: 'physical_activity_hours', label: 'Moving', color: '#6aa9c9' },
]

/* Friendly labels for the answer recap. */
const RECAP_LABELS = {
  age: 'Age',
  gender: 'Gender',
  country: 'Country',
  academic_level: 'Studying at',
  most_used_platform: 'Most used app',
  purpose_of_use: 'Mainly for',
  avg_daily_usage_hours: 'Phone time',
  daily_unlocks: 'Pickups a day',
  study_hours: 'Study time',
  physical_activity_hours: 'Moving',
  sleep_hours_per_night: 'Sleep',
  stress_level: 'Stress',
}

/* Score bands. The middle band is the range most people land in. */
const BANDS = [
  {
    max: 5.1,
    label: 'Running low',
    color: '#c97c6b',
    text: 'Your habits sit below where most people land. Sleep and phone time are usually the two worth looking at first — small shifts there tend to matter more than big ones anywhere else.',
  },
  {
    max: 7.1,
    label: 'Steady',
    color: '#dda44c',
    text: 'A mixed picture, and a common one. Some of what you do supports you and some of it works against you.',
  },
  {
    max: Infinity,
    label: 'Thriving',
    color: '#4e9e85',
    text: 'Your habits sit above where most people land. Whatever your routine is, it seems to be holding up — the sleep and movement blocks are the ones worth protecting.',
  },
]

const getBand = (score) => BANDS.find((band) => score < band.max)

let currentStep = 1
let lastAnswers = null
let lastScore = null

/* ==========================================================================
   1. SLIDERS
   ========================================================================== */

function initSliders() {
  document.querySelectorAll('[data-slider]').forEach((field) => {
    const input = field.querySelector('.range')
    const bubble = field.querySelector('[data-value]')
    const note = field.querySelector('[data-note]')
    const suffix = field.dataset.suffix || ''
    const typical = field.dataset.typical
    const whole = Number(input.step) >= 1

    function render(animate) {
      const value = Number(input.value)
      const min = Number(input.min)
      const max = Number(input.max)

      // paint the filled portion of the track
      input.style.setProperty('--pct', `${((value - min) / (max - min)) * 100}%`)
      bubble.textContent = (whole ? value : value.toFixed(1)) + suffix

      if (animate) {
        bubble.classList.add('pop')
        clearTimeout(bubble._t)
        bubble._t = setTimeout(() => bubble.classList.remove('pop'), 160)
      }

      if (note && typical) note.textContent = `Most people say ${typical}`
    }

    input.addEventListener('input', () => {
      render(true)
      scheduleDay()
    })

    render(false)
  })
}

/* ==========================================================================
   2. PILL ANSWERS
   Short lists are buttons, not dropdowns — one tap instead of open-scroll-pick.
   The chosen value goes into a hidden input so the form reads it normally.
   ========================================================================== */

function initPills() {
  document.querySelectorAll('[data-pills]').forEach((group) => {
    const hidden = group.querySelector('input[type="hidden"]')

    group.querySelectorAll('.pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        group.querySelectorAll('.pill').forEach((p) => p.classList.remove('selected'))
        pill.classList.add('selected')
        hidden.value = pill.dataset.value
        clearError(hidden.name)
      })
    })
  })
}

/* ==========================================================================
   3. THE 24-HOUR RIBBON
   Redraws live as the sliders move.
   ========================================================================== */

let dayBuilt = false

function buildDay() {
  $('day-bar').innerHTML = DAY_PARTS.map(
    (part) => `<span data-part="${part.name}" style="width:0;background:${part.color}"></span>`
  ).join('')

  $('day-legend').innerHTML =
    DAY_PARTS.map(
      (part) =>
        `<span><i style="background:${part.color}"></i>${part.label} <b data-legend="${part.name}">0h</b></span>`
    ).join('') +
    `<span style="color:var(--ink-dim)"><i style="border:1px solid var(--line-2)"></i>` +
    `<span data-rest-label>Unspoken for</span> <b data-rest>24h</b></span>`

  dayBuilt = true
}

function renderDay() {
  if (!dayBuilt) buildDay()

  const hours = {}
  let used = 0
  DAY_PARTS.forEach((part) => {
    const value = Number(form.elements[part.name].value) || 0
    hours[part.name] = value
    used += value
  })

  const over = used > 24
  const scale = over ? used : 24
  const free = Math.max(0, 24 - used)

  // update in place — no DOM teardown, so the width transition actually runs
  DAY_PARTS.forEach((part) => {
    const bar = $('day-bar').querySelector(`[data-part="${part.name}"]`)
    if (bar) bar.style.width = `${(hours[part.name] / scale) * 100}%`
    const label = $('day-legend').querySelector(`[data-legend="${part.name}"]`)
    if (label) label.textContent = `${hours[part.name]}h`
  })

  $('day-legend').querySelector('[data-rest-label]').textContent = over
    ? 'Over a day'
    : 'Unspoken for'
  $('day-legend').querySelector('[data-rest]').textContent = over ? '—' : `${free.toFixed(1)}h`
  $('day-total').textContent = `${used.toFixed(1)}h of 24`

  const warn = $('day-warn')
  if (over) {
    warn.textContent = `That comes to ${used.toFixed(
      1
    )} hours. Things do overlap — scrolling while half-studying counts twice — but it's worth a second look.`
    warn.classList.remove('hidden')
  } else {
    warn.classList.add('hidden')
  }
}

/* Slider drags fire far faster than the screen refreshes. Coalescing the
   redraw into one frame stops the input handler from queueing up work. */
let dayFrame = 0
function scheduleDay() {
  if (dayFrame) return
  dayFrame = requestAnimationFrame(() => {
    dayFrame = 0
    renderDay()
  })
}

/* ==========================================================================
   4. STEPS
   ========================================================================== */

function clearError(name) {
  const slot = document.querySelector(`[data-error-for="${name}"]`)
  if (slot) slot.textContent = ''
  const field = form.elements[name]
  if (field && field.classList) field.classList.remove('invalid')
}

function validateStep(step) {
  let ok = true

  REQUIRED_BY_STEP[step].forEach((name) => {
    const field = form.elements[name]
    const slot = document.querySelector(`[data-error-for="${name}"]`)
    const empty = String(field.value).trim() === ''

    if (slot) slot.textContent = empty ? 'Please answer this one.' : ''
    if (field.classList) field.classList.toggle('invalid', empty)
    if (empty) ok = false
  })

  return ok
}

function showStep(step) {
  currentStep = step

  document.querySelectorAll('.step').forEach((section) => {
    const isCurrent = Number(section.dataset.step) === step
    section.hidden = !isCurrent
    section.classList.toggle('is-active', isCurrent)
  })

  // step chips
  document.querySelectorAll('.steps__item').forEach((chip) => {
    const index = Number(chip.dataset.goto)
    chip.classList.toggle('is-active', index === step)
    chip.classList.toggle('is-done', index < step)
    chip.setAttribute('aria-selected', String(index === step))
  })

  // connector fill
  $('steps-fill').style.width = step > 1 ? '100%' : '0'
  $('steps-fill-2').style.width = step > 2 ? '100%' : '0'

  // buttons
  $('back-btn').hidden = step === 1
  $('next-btn').hidden = step === 3
  $('submit-btn').hidden = step !== 3
  $('form-error').classList.add('hidden')

  scrollToCard()
}

/* Only scroll when the card isn't already sitting near the top. */
function scrollToCard() {
  const card = $('check')
  const top = card.getBoundingClientRect().top
  if (top > -24 && top < window.innerHeight * 0.45) return

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  card.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
}

function goNext() {
  if (!validateStep(currentStep)) {
    const error = $('form-error')
    error.textContent = 'A couple of answers are still missing.'
    error.classList.remove('hidden')
    return
  }
  if (currentStep < 3) showStep(currentStep + 1)
}

/* ==========================================================================
   5. TALKING TO THE SERVICE
   The page never shows technical detail — anything useful for debugging goes
   to the console instead, and the visitor gets a plain-English message.
   ========================================================================== */

function collectAnswers() {
  const answers = {}
  new FormData(form).forEach((value, key) => {
    answers[key] = NUMERIC.includes(key) ? Number(value) : String(value).trim()
  })
  return answers
}

async function getScore(answers) {
  const response = await fetch(`${API_BASE}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(answers),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    console.error('[Daylight] request failed', response.status, body)
    const error = new Error('bad-response')
    error.kind = 'server'
    throw error
  }

  const data = await response.json()
  return data.predicted_mental_health_score
}

function friendlyError(error) {
  if (error instanceof TypeError || error.kind === 'network') {
    return "We can't reach the service right now. Check your connection and give it another go in a moment."
  }
  return 'Something went wrong working out your score. Please try again.'
}

/* Quiet connectivity check — only surfaces if something is wrong. */
async function checkConnection() {
  const online = await fetch(`${API_BASE}/`)
    .then((r) => r.ok)
    .catch(() => false)
  $('offline-bar').classList.toggle('hidden', online)
}

/* ==========================================================================
   6. THE SUNRISE
   The sun's height along the arc is the score: low sits on the horizon, high
   climbs toward noon, and the sky warms as it rises.
   ========================================================================== */

/* Blend two hex colours. Used to warm the sky as the score climbs. */
function mix(a, b, t) {
  const parse = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const [r1, g1, b1] = parse(a)
  const [r2, g2, b2] = parse(b)
  const to = (n) => Math.round(n).toString(16).padStart(2, '0')
  return `#${to(r1 + (r2 - r1) * t)}${to(g1 + (g2 - g1) * t)}${to(b1 + (b2 - b1) * t)}`
}

function drawSunrise(score) {
  const t = Math.min(1, Math.max(0, score / 10))

  // Quarter arc: centre (170,164), radius 124, from the left horizon to noon.
  const angle = Math.PI - (Math.PI / 2) * t
  const x = 170 + 124 * Math.cos(angle)
  const y = 164 - 124 * Math.sin(angle)

  const sun = $('sun')
  const halo = $('sun-halo')
  sun.setAttribute('cx', x.toFixed(1))
  sun.setAttribute('cy', y.toFixed(1))
  halo.setAttribute('cx', x.toFixed(1))
  halo.setAttribute('cy', y.toFixed(1))

  // sky warms as the sun climbs
  $('sky-top').setAttribute('stop-color', mix('#2b3352', '#7fb0cf', t))
  $('sky-bottom').setAttribute('stop-color', mix('#584a68', '#f4c894', t))

  // stars fade out as it gets brighter
  const stars = [
    [60, 40], [110, 74], [225, 36], [268, 68], [300, 30], [196, 96], [258, 112], [88, 110],
  ]
  $('sun-stars').innerHTML = stars
    .map(
      ([sx, sy], i) =>
        `<circle cx="${sx}" cy="${sy}" r="${i % 3 === 0 ? 1.6 : 1.1}" fill="#fff" opacity="${(
          (1 - t) * 0.75
        ).toFixed(2)}"/>`
    )
    .join('')
}

function countUp(target) {
  const node = $('score-value')

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    node.textContent = target.toFixed(1)
    return
  }

  const start = performance.now()
  const step = (now) => {
    const p = Math.min(1, (now - start) / 1200)
    node.textContent = (target * (1 - Math.pow(1 - p, 3))).toFixed(1)
    if (p < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

/* ==========================================================================
   7. SHOWING THE RESULT
   ========================================================================== */

function showPanel(which) {
  $('stepper').hidden = which !== 'form'
  $('result').hidden = which !== 'result'
  $('error-panel').hidden = which !== 'error'
}

function renderResult(score, answers) {
  const band = getBand(score)
  lastScore = score
  lastAnswers = answers

  document.documentElement.style.setProperty('--band', band.color)

  showPanel('result')
  drawSunrise(score)
  countUp(score)

  $('band-label').textContent = band.label
  $('band-text').textContent = band.text

  // marker along the 3.5–9.5 span the scores realistically cover
  const position = ((score - 3.5) / 6) * 100
  $('scale-marker').style.left = `${Math.min(98, Math.max(2, position))}%`

  // recap of what was answered
  $('recap-list').innerHTML = Object.entries(RECAP_LABELS)
    .map(([key, label]) => {
      let value = answers[key]
      if (key === 'daily_unlocks') value = `${value} times`
      else if (key === 'age') value = `${value} years`
      else if (NUMERIC.includes(key)) value = `${value}h`
      return `<div><dt>${label}</dt><dd>${value}</dd></div>`
    })
    .join('')

  runTweaks(score, answers)
  saveToHistory(score)
  scrollToCard()
}

/* ==========================================================================
   8. "WHAT A SMALL CHANGE WOULD DO"
   Re-scores three near-miss versions of the same day so the difference is
   measured, not guessed at.
   ========================================================================== */

async function runTweaks(baseScore, answers) {
  const list = $('tweaks-list')
  const spinner = $('tweaks-spinner')

  list.innerHTML = ''
  spinner.classList.remove('hidden')

  const options = [
    {
      label: 'An extra hour of sleep',
      change: { sleep_hours_per_night: answers.sleep_hours_per_night + 1 },
      skip: answers.sleep_hours_per_night >= 12,
    },
    {
      label: 'One hour less on your phone',
      change: { avg_daily_usage_hours: Math.max(0, answers.avg_daily_usage_hours - 1) },
      skip: answers.avg_daily_usage_hours < 1,
    },
    {
      label: 'Thirty more minutes moving',
      change: { physical_activity_hours: answers.physical_activity_hours + 0.5 },
      skip: answers.physical_activity_hours >= 6,
    },
  ].filter((option) => !option.skip)

  if (!options.length) {
    spinner.classList.add('hidden')
    return
  }

  try {
    const scores = await Promise.all(options.map((o) => getScore({ ...answers, ...o.change })))

    list.innerHTML = options
      .map((option, i) => {
        const delta = scores[i] - baseScore
        const tone = delta > 0.05 ? 'up' : delta < -0.05 ? 'down' : 'flat'
        const sign = delta > 0 ? '+' : ''
        const shown = tone === 'flat' ? 'no change' : `${sign}${delta.toFixed(1)}`
        return `<div class="tweak" style="animation-delay:${i * 70}ms">
                  <span>${option.label}</span>
                  <span class="tweak__delta ${tone}">${shown}</span>
                </div>`
      })
      .join('')
  } catch (error) {
    console.error('[Daylight] comparisons failed', error)
    list.innerHTML = '<p class="field__note">Comparisons aren\'t available right now.</p>'
  } finally {
    spinner.classList.add('hidden')
  }
}

/* ==========================================================================
   9. HISTORY (this browser only)
   ========================================================================== */

const HISTORY_KEY = 'daylight.history'

function readHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []
  } catch {
    return []
  }
}

function saveToHistory(score) {
  const entries = [{ score, at: Date.now() }, ...readHistory()].slice(0, 5)
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries))
  } catch {
    /* private browsing — the page still works, it just won't remember */
  }
  renderHistory()
}

function renderHistory() {
  const entries = readHistory()
  const section = $('history')

  section.classList.toggle('hidden', entries.length === 0)

  $('history-list').innerHTML = entries
    .map((entry) => {
      const band = getBand(entry.score)
      const when = new Date(entry.at).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
      return `<div class="history__item">
                <span class="history__score" style="color:${band.color}">${entry.score.toFixed(1)}</span>
                <span>${band.label}</span>
                <span class="history__when">${when}</span>
              </div>`
    })
    .join('')
}

/* ==========================================================================
   10. TOASTS
   ========================================================================== */

function toast(message, tone) {
  const tones = { good: '#4e9e85', bad: '#c97c6b' }
  const node = document.createElement('div')
  node.className = 'toast'
  node.style.setProperty('--tone', tones[tone] || '#2f6f5e')
  node.textContent = message
  $('toasts').appendChild(node)
  setTimeout(() => node.remove(), 3800)
}

/* ==========================================================================
   11. EVENTS
   ========================================================================== */

$('next-btn').addEventListener('click', goNext)
$('back-btn').addEventListener('click', () => showStep(Math.max(1, currentStep - 1)))

/* Let the step chips jump backwards, but never skip ahead past unanswered steps. */
document.querySelectorAll('.steps__item').forEach((chip) => {
  chip.addEventListener('click', () => {
    const target = Number(chip.dataset.goto)
    if (target < currentStep) showStep(target)
    else if (target > currentStep) goNext()
  })
})

form.addEventListener('submit', async (event) => {
  event.preventDefault()

  // Enter inside a text box can fire submit early — treat that as "continue".
  if (currentStep !== 3) return goNext()
  if (!validateStep(3)) {
    const error = $('form-error')
    error.textContent = 'A couple of answers are still missing.'
    error.classList.remove('hidden')
    return
  }

  const answers = collectAnswers()
  const button = $('submit-btn')

  button.disabled = true
  $('spinner').classList.remove('hidden')
  $('submit-label').textContent = 'Working it out'

  try {
    const score = await getScore(answers)
    renderResult(score, answers)
  } catch (error) {
    console.error('[Daylight]', error)
    $('error-text').textContent = friendlyError(error)
    showPanel('error')
    checkConnection()
  } finally {
    button.disabled = false
    $('spinner').classList.add('hidden')
    $('submit-label').textContent = 'See my score'
  }
})

$('again-btn').addEventListener('click', () => {
  showPanel('form')
  showStep(1)
})

$('retry-btn').addEventListener('click', () => {
  showPanel('form')
  form.requestSubmit()
})

$('error-back-btn').addEventListener('click', () => {
  showPanel('form')
  showStep(1)
})

$('save-btn').addEventListener('click', () => {
  if (lastScore === null) return

  const band = getBand(lastScore)
  const lines = [
    'Daylight — your daily habits check',
    new Date().toLocaleString(),
    '',
    `Score: ${lastScore.toFixed(1)} out of 10  (${band.label})`,
    '',
    'Your answers:',
    ...Object.entries(RECAP_LABELS).map(([key, label]) => `  ${label}: ${lastAnswers[key]}`),
    '',
    'A wellbeing estimate based on habit patterns — not a diagnosis or medical advice.',
  ]

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `daylight-${new Date().toISOString().slice(0, 10)}.txt`
  link.click()
  URL.revokeObjectURL(url)
  toast('Saved to your downloads', 'good')
})

$('clear-history').addEventListener('click', () => {
  localStorage.removeItem(HISTORY_KEY)
  renderHistory()
  toast('Cleared')
})

/* Text answers clear their own error as soon as you type. */
form.querySelectorAll('.text-input').forEach((input) => {
  input.addEventListener('input', () => clearError(input.name))
})

/* ==========================================================================
   12. START
   ========================================================================== */

initSliders()
initPills()
renderDay()
renderHistory()
checkConnection()
setInterval(checkConnection, 25000)
