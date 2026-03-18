import { useState, useMemo } from 'react'
import zxcvbn from 'zxcvbn'
import './App.css'

// Inline SVGs so fill="currentColor" inherits from button (Bootstrap Icons style)
const IconEye = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" className="toggle-icon" aria-hidden>
    <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8M1.173 8a13 13 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5s3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5s-3.879-1.168-5.168-2.457A13 13 0 0 1 1.172 8z"/>
    <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0"/>
  </svg>
)
const IconEyeSlash = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" className="toggle-icon" aria-hidden>
    <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7 7 0 0 0-2.79.588l.77.771A6 6 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 1.12-1.465 1.755q-.247.248-.517.486z"/>
    <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829"/>
    <path d="M3.35 5.47q-.27.24-.518.487A13 13 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7 7 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12z"/>
  </svg>
)

const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong']
const STRENGTH_COLORS = ['#f87171', '#fb923c', '#fbbf24', '#34d399', '#22d3ee']

// One-sentence tooltips for each pattern type (shown on ? hover)
const PATTERN_TOOLTIPS = {
  bruteforce: 'Unstructured part not matched by any known pattern; attackers would try random combinations.',
  dictionary: 'Found in a word list (common passwords, English words, names); rank shows how common it is.',
  spatial: 'Follows a path on the keyboard (e.g. qwerty); easy to guess if short or with few turns.',
  sequence: 'Consecutive characters like abc or 123; very easy to guess.',
  repeat: 'Repeated character or substring (e.g. aaa, abcabc); only slightly harder than the base.',
  regex: 'Matches a known pattern such as a recent year; often easy to guess.',
  date: 'Looks like a date (year, month, day); often easy to guess and personal.',
}

const MATCH_SEQUENCE_TOOLTIP = 'The list of patterns zxcvbn found in your password; each part is scored and combined to estimate strength.'

// Dictionary / word list names → label and link to the exact .txt file on zxcvbn GitHub
const ZXCVBN_REPO = 'https://github.com/dropbox/zxcvbn'
const ZXCVBN_DATA_BASE = 'https://github.com/dropbox/zxcvbn/blob/master/data'
const DICTIONARY_LINKS = {
  passwords: { label: 'Common passwords', url: `${ZXCVBN_DATA_BASE}/passwords.txt` },
  english_wikipedia: { label: 'English (Wikipedia)', url: `${ZXCVBN_DATA_BASE}/english_wikipedia.txt` },
  us_tv_and_film: { label: 'US TV & film', url: `${ZXCVBN_DATA_BASE}/us_tv_and_film.txt` },
  surnames: { label: 'Surnames', url: `${ZXCVBN_DATA_BASE}/surnames.txt` },
  male_names: { label: 'Male names', url: `${ZXCVBN_DATA_BASE}/male_names.txt` },
  female_names: { label: 'Female names', url: `${ZXCVBN_DATA_BASE}/female_names.txt` },
}

// Tooltip: follows mouse position, disappears when hover ends
const TOOLTIP_OFFSET = { x: 14, y: 10 }

/**
 * Renders a small "?" tooltip that follows the mouse while you hover.
 * Used to explain what each zxcvbn pattern type means.
 *
 * @param {{ text: string }} props
 */
function HelpTip({ text }) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  const updatePos = (e) => {
    setPos({
      x: Math.max(8, Math.min(e.clientX + TOOLTIP_OFFSET.x, window.innerWidth - 240)),
      y: Math.max(8, Math.min(e.clientY + TOOLTIP_OFFSET.y, window.innerHeight - 80)),
    })
  }
  const handleMouseEnter = (e) => {
    setVisible(true)
    updatePos(e)
  }
  const handleMouseLeave = () => setVisible(false)
  const handleMouseMove = updatePos

  return (
    <span
      className="help-tip-wrap"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >
      <span className="help-tip-icon" aria-label="Explanation">?</span>
      {visible && (
        <span
          className="help-tip-bubble help-tip-bubble--follow"
          style={{
            left: pos.x,
            top: pos.y,
          }}
        >
          {text}
        </span>
      )}
    </span>
  )
}

/**
 * Converts zxcvbn match pattern names (dictionary, sequence, etc.)
 * into short human-readable labels.
 *
 * @param {string} pattern
 * @returns {string}
 */
function getPatternTypeLabel(pattern) {
  const labels = {
    bruteforce: 'Bruteforce',
    dictionary: 'Dictionary',
    spatial: 'Spatial',
    sequence: 'Sequence',
    repeat: 'Repeat',
    regex: 'Regex',
    date: 'Date',
  }
  return labels[pattern] || pattern
}

/**
 * For dictionary matches, returns the label and the direct GitHub URL
 * to the exact `.txt` word list file used by zxcvbn.
 *
 * @param {object} match zxcvbn match object
 * @returns {{ label: string, url: string } | null}
 */
function getDictionaryLink(match) {
  if (match.pattern !== 'dictionary' || !match.dictionary_name) return null
  const key = match.dictionary_name
  return DICTIONARY_LINKS[key] || { label: key.replace(/_/g, ' '), url: `${ZXCVBN_DATA_BASE}/${key}.txt` }
}

/**
 * Produces a human-readable description for each matched zxcvbn pattern.
 * For dictionary matches, it returns an object so the UI can render a link.
 *
 * @param {object} match zxcvbn match object
 * @returns {string | { type: 'dictionary', name: string, rank: string, extra: string }}
 */
function getPatternDescription(match) {
  const token = match.token
  switch (match.pattern) {
    case 'dictionary':
      const name = (match.dictionary_name || '').replace(/_/g, ' ')
      const rank = match.rank != null ? ` (rank #${match.rank})` : ''
      const extra = [match.l33t && 'l33t', match.reversed && 'reversed'].filter(Boolean).join(', ')
      return { type: 'dictionary', name, rank, extra }
    case 'spatial':
      return `${(match.graph || 'qwerty').toUpperCase()} (${match.turns || 1} turn(s))`
    case 'sequence':
      return (match.sequence_name || 'chars').toLowerCase()
    case 'repeat':
      return `"${(match.base_token || '').slice(0, 8)}${(match.base_token || '').length > 8 ? '…' : ''}" × ${match.repeat_count ?? 0}`
    case 'regex':
      return match.regex_name || 'match'
    case 'date':
      const parts = [match.year, match.month, match.day].filter(Boolean)
      return parts.join('-') || 'date pattern'
    case 'bruteforce':
      return 'unstructured'
    default:
      return match.pattern || 'Unknown'
  }
}

/**
 * Renders the pattern "detail" part:
 * - Dictionary: shows the dictionary name as a clickable link.
 * - Others: shows plain text.
 *
 * @param {{ match: object }} props
 */
function PatternDetail({ match }) {
  const desc = getPatternDescription(match)
  if (typeof desc === 'object' && desc.type === 'dictionary') {
    const link = getDictionaryLink(match)
    return (
      <span className="pattern-detail">
        <a href={link.url} target="_blank" rel="noopener noreferrer" className="pattern-dict-link" title="View word list source">
          {link.label}
        </a>
        {desc.rank}{desc.extra ? ` — ${desc.extra}` : ''}
      </span>
    )
  }
  return <span className="pattern-detail">{String(desc)}</span>
}

function App() {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const result = useMemo(() => {
    if (!password) return null
    return zxcvbn(password)
  }, [password])

  const score = result?.score ?? -1
  const scoreColor = score >= 0 ? STRENGTH_COLORS[score] : 'var(--text-muted)'
  const label = score >= 0 ? STRENGTH_LABELS[score] : 'Enter a password'
  const sequence = result?.sequence ?? []

  return (
    <main className="app">
      <header className="header">
        <h1>Password Strength Checker</h1>
        <p className="subtitle">
          Powered by <a href="https://github.com/dropbox/zxcvbn" target="_blank" rel="noopener noreferrer">zxcvbn</a> — realistic strength estimation
        </p>
      </header>

      <section className="card">
        <label htmlFor="password" className="label">Your password</label>
        <div className="input-wrap">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Type or paste a password..."
            className="input"
            autoComplete="off"
            autoFocus
          />
          <button
            type="button"
            className="toggle-visibility"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <IconEyeSlash /> : <IconEye />}
          </button>
        </div>

        {password && (
          <>
            <div className="strength-row">
              <span className="strength-label">Strength</span>
              <span className="strength-value" style={{ color: scoreColor }}>
                {label}
              </span>
            </div>
            <div className="meter-wrap">
              <div
                className="meter-fill"
                style={{
                  width: `${((score + 1) / 5) * 100}%`,
                  backgroundColor: scoreColor,
                }}
              />
            </div>

            {/* Warnings & suggestions (e.g. "This is a top-100 common password") */}
            {result && result.feedback && (result.feedback.warning || (result.feedback.suggestions?.length > 0)) && (
              <div className="feedback">
                {result.feedback.warning && (
                  <p className="feedback-warning">⚠️ {result.feedback.warning}</p>
                )}
                {result.feedback.suggestions && result.feedback.suggestions.length > 0 && (
                  <ul className="suggestions">
                    {result.feedback.suggestions.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Match sequence: each pattern type with (?) tooltip */}
            {sequence.length > 0 && (
              <div className="analysis-section">
                <h3 className="section-title">
                  Match sequence
                  <HelpTip text={MATCH_SEQUENCE_TOOLTIP} />
                </h3>
                <p className="analysis-desc">How zxcvbn broke down your password:</p>
                <ul className="pattern-list">
                  {sequence.map((match, i) => {
                    const typeLabel = getPatternTypeLabel(match.pattern)
                    const tooltip = PATTERN_TOOLTIPS[match.pattern] || 'Matched pattern.'
                    const hasL33t = match.pattern === 'dictionary' && match.l33t && (match.sub_display || match.sub)
                    const showUnL33ted = match.pattern === 'dictionary' && match.l33t && match.matched_word
                    const subDisplay = match.sub_display || (match.sub && Object.entries(match.sub).map(([k, v]) => `${k} -> ${v}`).join(', '))
                    return (
                      <li key={i} className="pattern-item">
                        <div className="pattern-item-main">
                          <code className="pattern-token">"{match.token}"</code>
                          <span className="pattern-type">
                            {typeLabel}
                            <HelpTip text={tooltip} />
                          </span>
                          <PatternDetail match={match} />
                          {match.guesses_log10 != null && (
                            <span className="pattern-guesses">log10 guesses: {match.guesses_log10.toFixed(1)}</span>
                          )}
                        </div>
                        {(hasL33t || showUnL33ted) && (
                          <div className="pattern-item-extra">
                            {hasL33t && (
                              <div className="pattern-extra-line">
                                <span className="pattern-extra-label">l33t subs:</span>
                                <span className="pattern-extra-value">{subDisplay}</span>
                              </div>
                            )}
                            {showUnL33ted && (
                              <div className="pattern-extra-line">
                                <span className="pattern-extra-label">un-l33ted:</span>
                                <span className="pattern-extra-value">{match.matched_word}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {/* Dictionaries / word lists used in this result (with links) */}
            {sequence.some((m) => m.pattern === 'dictionary') && (() => {
              const used = [...new Set(sequence.filter((m) => m.pattern === 'dictionary').map((m) => m.dictionary_name).filter(Boolean))]
              return (
                <div className="libraries-section">
                  <h3 className="section-title">Dictionaries used</h3>
                  <p className="analysis-desc">Word lists this password was matched against (from zxcvbn):</p>
                  <ul className="libraries-list">
                    {used.map((dictKey) => {
                      const info = DICTIONARY_LINKS[dictKey] || { label: dictKey.replace(/_/g, ' '), url: `${ZXCVBN_DATA_BASE}/${dictKey}.txt` }
                      return (
                        <li key={dictKey}>
                          <a href={info.url} target="_blank" rel="noopener noreferrer" className="library-link">
                            {info.label}
                          </a>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })()}

            <div className="crack-times">
              <h3 className="crack-title">Estimated crack times</h3>
              <ul className="crack-list">
                <li>
                  <span className="crack-scenario">Online (throttled, 100/hour)</span>
                  <span className="crack-value">{result?.crack_times_display?.online_throttling_100_per_hour ?? '—'}</span>
                </li>
                <li>
                  <span className="crack-scenario">Online (10/sec)</span>
                  <span className="crack-value">{result?.crack_times_display?.online_no_throttling_10_per_second ?? '—'}</span>
                </li>
                <li>
                  <span className="crack-scenario">Offline (slow hash, 10k/sec)</span>
                  <span className="crack-value">{result?.crack_times_display?.offline_slow_hashing_1e4_per_second ?? '—'}</span>
                </li>
                <li>
                  <span className="crack-scenario">Offline (fast hash, 10B/sec)</span>
                  <span className="crack-value">{result?.crack_times_display?.offline_fast_hashing_1e10_per_second ?? '—'}</span>
                </li>
              </ul>
            </div>

            <p className="meta">
              Guesses (log10): <code>{result?.guesses_log10?.toFixed(1) ?? '—'}</code>
              {' · '}
              Calc: <code>{result?.calc_time ?? 0} ms</code>
            </p>
          </>
        )}
      </section>

      <footer className="footer">
        No data is sent to any server. Analysis runs entirely in your browser.
      </footer>
    </main>
  )
}

export default App
