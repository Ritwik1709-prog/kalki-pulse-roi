'use client'

/**
 * Forge: a hardware-shop hero. A forged-wordmark splash, a WebGL window-light backdrop, a knolling photo of a
 * workbench whose tools lift off the board as you pick a project, and a kit dock that counts them.
 *
 * Content (brand, navigation, copy, categories, tools, projects and the bench photo) is passed as props; the demo
 * supplies the original shop. Colours, splash, intro, lamp and shader dials are props with the original values as defaults.
 *
 * Dependencies: motion (motion/react), lucide-react
 * Fonts: Archivo (variable, wdth + wght) and Geist Mono; load them in the host page, the component falls back to system sans/mono.
 *
 * Usage: <Forge brand={{ name: 'Forge', href: '#' }} projects={projects} tools={tools} categories={categories} boardImage={board} />
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, memo } from 'react'
import type { CSSProperties, FocusEvent, FormEvent, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { animate, AnimatePresence, domMax, LazyMotion, m, MotionConfig, useMotionValue, useReducedMotion } from 'motion/react'
import { ArrowRight, BadgeCheck, Drill, Glasses, Hammer, LayoutGrid, Library, PanelTop, Ruler, Scissors, Wrench, ChevronDown, Eye, Headphones, Menu, MousePointerClick, Search, ShieldCheck, ShoppingCart, User, X, Check, Plus, RotateCcw } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// Joins the truthy class names; the block's classes are passed through untouched
const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')

/* ------------------------------ Props ------------------------------ */

type CategoryId = string
type ToolId = string
type ProjectId = string
type ProjectType = ResolvedProject

/** Built-in icon names accepted by the icon props; any lucide-react icon component works as well */
export type ForgeIconName = 'drill' | 'hammer' | 'ruler' | 'wrench' | 'glasses' | 'layout-grid' | 'panel-top' | 'scissors' | 'library'

const ICONS: Record<ForgeIconName, LucideIcon> = {
  drill: Drill,
  hammer: Hammer,
  ruler: Ruler,
  wrench: Wrench,
  glasses: Glasses,
  'layout-grid': LayoutGrid,
  'panel-top': PanelTop,
  scissors: Scissors,
  library: Library
}

const resolveIcon = (icon: ForgeIconName | LucideIcon): LucideIcon => (typeof icon === 'string' ? ICONS[icon] : icon)

export interface ForgeCategory {
  /** Label shown in the menu and on a tool's label */
  label: string
  /** Built-in icon name, or an icon component such as one from lucide-react */
  icon: ForgeIconName | LucideIcon
  /** Link target */
  href: string
  /** One-line description in the Categories menu */
  blurb: string
}

export interface ForgeTool {
  /** Name shown on the tool's label and in the kit */
  name: string
  /** Id of the category the tool belongs to */
  category: CategoryId
  /** Link target */
  href: string
  /** Where the tool sits in the bench photo as [left, top, width, height] in percent; its cut-out is drawn exactly there */
  box: [number, number, number, number]
  /** URL of the tool's transparent cut-out, cropped to its box */
  image: string
}

export interface ForgeProject {
  /** Unique id; the id "all" is treated as browsing (no kit) */
  id: ProjectId
  /** Label of the tab */
  label: string
  /** Built-in icon name, or an icon component, for the tab */
  icon: ForgeIconName | LucideIcon
  /** Ids of the tools this job needs; they lift off the board when the project is picked */
  tools: ToolId[]
  /** The three headline lines while this job is chosen; the last is set in the accent colour */
  title: [string, string, string]
}

type ResolvedCategory = Omit<ForgeCategory, 'icon'> & { icon: LucideIcon }
type ResolvedProject = Omit<ForgeProject, 'icon'> & { icon: LucideIcon }

export interface ForgeNav {
  /** Primary links; a link with menu: true opens the Categories dropdown */
  links: Array<{ label: string; href: string; menu?: boolean }>
  /** The search form's action and placeholder */
  search: { action: string; placeholder: string }
  /** Account icon link */
  account: { label: string; href: string }
  /** Cart icon link */
  cart: { label: string; href: string }
  /** Pixels scrolled before the bar picks up its frosted background */
  frostAfter: number
}

export interface ForgeCopy {
  /** Small line above the headline (also under the splash wordmark) */
  eyebrow: string
  /** Supporting paragraph under the headline */
  subtext: string
  /** Primary button */
  primary: { label: string; href: string }
  /** Secondary button */
  secondary: { label: string; href: string }
  /** Label above the project tabs */
  picker: string
  /** Hint shown over the bench photo */
  hint: string
  /** Trust row items (rendered with a check, shield and headset icon in turn) */
  trust: string[]
}

export interface ForgeBoardImage {
  /** Large bench photo URL (used from 960px up) */
  large: string
  /** Small bench photo URL (960px wide) */
  small: string
  /** Intrinsic width of the large photo in px, used for its aspect ratio */
  width: number
  /** Intrinsic height of the large photo in px */
  height: number
  /** Accessible description of the photo */
  alt: string
}

export interface ForgeTheme {
  /** Page and hero background */
  page: string
  /** Raised surfaces: the kit dock, tool labels, the board frame */
  card: string
  /** Headline and primary text */
  ink: string
  /** Supporting text */
  grey: string
  /** Brand accent: last headline line, primary button, active states */
  accent: string
  /** Primary button on hover */
  accentDeep: string
  /** Text that sits on the accent */
  onAccent: string
  /** Hairlines and outlines */
  line: string
}

export interface ForgeSplash {
  /** Show the forging splash before the hero */
  enabled: boolean
  /** Only show it on the first visit in a browser tab session */
  oncePerSession: boolean
  /** Screens narrower than this width in px skip the splash */
  skipBelow: number
  /** Seconds before the first strike */
  firstStrike: number
  /** Seconds between strikes */
  strikeEvery: number
  /** Pause on the finished wordmark before it flies to the nav, in seconds */
  hold: number
  /** Length of the wordmark's flight to the nav, in seconds */
  flight: number
  /** Sparks thrown by each strike */
  sparks: number
  /** sessionStorage key remembering the splash was seen */
  storageKey: string
}

export interface ForgeIntro {
  /** Play the bench-photo intro */
  enabled: boolean
  /** Seconds after the splash hands over before the bench starts to appear */
  delay: number
  /** Seconds the bench takes to come into focus */
  reveal: number
  /** Starting scale of the bench photo */
  scale: number
  /** Starting blur of the bench photo in px */
  blur: number
  /** Seconds the window light takes to open */
  beam: number
}

export interface ForgeBoardOptions {
  /** How dark the tools you do not need go, 0 = untouched, 1 = black */
  dim: number
  /** How far a kit tool lifts off the board, in px */
  lift: number
  /** How much a lifted tool grows */
  liftScale: number
  /** How far the lamp pushes each tool's shadow, in px at the board's edge */
  shadowReach: number
  /** Where the lamp rests when the pointer is away, in percent of the board */
  lampRest: { x: number; y: number }
}

export interface ForgeShader {
  /** Page colour behind the light, sRGB 0-1 (must match theme.page) */
  base: [number, number, number]
  /** Colour of the sunlight, sRGB 0-1 */
  light: [number, number, number]
  /** How bright the beam is */
  intensity: number
  /** How much dust shows in the beam, 0 = none */
  dust: number
  /** Film grain strength */
  grain: number
  /** How far the light leans with the cursor, 0 = off */
  cursor: number
  /** Overall animation speed, 1 = as designed */
  speed: number
  /** Render size relative to the screen; lower is cheaper and softer */
  resolution: number
}

export interface ForgeProps {
  /** Wordmark and where it links. Default: empty */
  brand?: { name: string; href: string }
  /** Navigation. Default: no links */
  nav?: ForgeNav
  /** Hero copy. Default: empty */
  copy?: ForgeCopy
  /** Categories by id, listed in the Categories dropdown in categoryOrder. Default: none */
  categories?: Record<CategoryId, ForgeCategory>
  /** The order the Categories dropdown lists them in. Default: none */
  categoryOrder?: CategoryId[]
  /** The tools lying on the bench, by id. Default: none */
  tools?: Record<ToolId, ForgeTool>
  /** The jobs offered as tabs. The hero is not rendered without at least one. Default: none */
  projects?: ForgeProject[]
  /** Id of the job the hero opens on. Default: the first project */
  defaultProject?: ProjectId
  /** The bench photo. Omit to render no photo */
  boardImage?: ForgeBoardImage
  /** Colour roles; any subset overrides the original palette */
  theme?: Partial<ForgeTheme>
  /** Splash dials; any subset overrides the originals */
  splash?: Partial<ForgeSplash>
  /** Bench intro dials; any subset overrides the originals */
  intro?: Partial<ForgeIntro>
  /** Bench lamp and lift dials; any subset overrides the originals */
  boardOptions?: Partial<ForgeBoardOptions>
  /** WebGL backdrop dials; any subset overrides the originals */
  shader?: Partial<ForgeShader>
  /** Forces reduced motion on or off; by default the visitor's prefers-reduced-motion setting is used */
  reducedMotion?: boolean
  /** Extra classes for the root element */
  className?: string
}

/* ----------------------------- Defaults ----------------------------- */

// The house curve for every entrance and hover
const EASE_OUT = [0.22, 1, 0.36, 1] as const

const DEFAULT_THEME: ForgeTheme = {
  page: '#141414',
  card: '#1D1C1B',
  ink: '#F5F3EF',
  grey: '#AAA7A3',
  accent: '#FF814D',
  accentDeep: '#F26A33',
  onAccent: '#141414',
  line: 'rgba(255, 255, 255, 0.18)'
}

const DEFAULT_SPLASH: ForgeSplash = {
  enabled: true,
  oncePerSession: false,
  skipBelow: 0,
  firstStrike: 0.3,
  strikeEvery: 0.17,
  hold: 0.5,
  flight: 0.9,
  sparks: 9,
  storageKey: 'forge-splash-seen'
}

const DEFAULT_INTRO: ForgeIntro = { enabled: true, delay: 0.05, reveal: 1.4, scale: 1.08, blur: 14, beam: 1.8 }

const DEFAULT_BOARD: ForgeBoardOptions = { dim: 0.8, lift: 6, liftScale: 1.018, shadowReach: 30, lampRest: { x: 22, y: 12 } }

const DEFAULT_SHADER: ForgeShader = {
  base: [0.078, 0.078, 0.078],
  light: [1, 0.74, 0.52],
  intensity: 0.17,
  dust: 0.55,
  grain: 0.025,
  cursor: 0.35,
  speed: 1,
  resolution: 0.75
}

interface ForgeContextValue {
  BRAND: { name: string; href: string }
  NAV: ForgeNav
  COPY: ForgeCopy
  CATEGORIES: Record<CategoryId, ResolvedCategory>
  CATEGORY_ORDER: CategoryId[]
  TOOLS: Record<ToolId, ForgeTool>
  TOOL_IDS: ToolId[]
  toolImage: (id: ToolId) => string
  PROJECTS: ResolvedProject[]
  DEFAULT_PROJECT: ProjectId
  ASSETS: { board: ForgeBoardImage | undefined }
  BOARD: ForgeBoardOptions
  INTRO: ForgeIntro
  SPLASH: ForgeSplash
  SHADER: ForgeShader
  REDUCED: boolean | undefined
}

const ForgeContext = createContext<ForgeContextValue | null>(null)

const useForge = () => {
  const value = useContext(ForgeContext)

  if (!value) throw new Error('Forge parts must render inside <Forge>')

  return value
}

/* ----------------------------- Parts ----------------------------- */



// Server render and first paint assume the query fails; the real value lands on hydration
const useMediaQuery = (query: string) => {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)

      list.addEventListener('change', onChange)

      return () => list.removeEventListener('change', onChange)
    },
    [query]
  )

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  )
}




type OpeningType = {
  // False while the splash is forging the logo; the hero holds its entrances until it turns true
  opened: boolean
  open: () => void
}

const OpeningContext = createContext<OpeningType>({ opened: true, open: () => { } })

/**
 * The splash sits at the root, above the sticky nav, while the hero it opens lives inside main;
 * this is the one flag they share
 */
const OpeningProvider = ({ children }: { children: ReactNode }) => {
  const { SPLASH } = useForge()

  // States
  const [opened, setOpened] = useState(!SPLASH.enabled)

  // Hooks
  const open = useCallback(() => setOpened(true), [])
  const value = useMemo(() => ({ opened, open }), [opened, open])

  return <OpeningContext.Provider value={value}>{children}</OpeningContext.Provider>
}

const useOpening = () => useContext(OpeningContext)




/**
 * Loads Motion's animation, gesture, drag and layout features for the block's m
 * components. Under reduced motion, Motion drops every movement and keeps only the fades
 */
const MotionProvider = ({ children }: { children: ReactNode }) => {
  const { REDUCED } = useForge()
  const reduced = REDUCED === true

  return (
    <LazyMotion features={domMax}>
      <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>{children}</MotionConfig>
    </LazyMotion>
  )
}





type WorkshopLightProps = {
  reduceMotion: boolean
  finePointer: boolean

  // The window stays shut until this turns true, then the beam opens
  lit: boolean
}

// One triangle that covers the screen, built from the vertex index, so no buffers are needed
const VERTEX = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

/**
 * Window light in a dark workshop. Coordinates are scaled by the shorter side, so the beam keeps its
 * shape on a wide desktop and a tall phone alike; the beam always enters from above the top-left
 */
const FRAGMENT = `#version 300 es
precision highp float;

uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform vec3 uBase;
uniform vec3 uLight;
uniform float uIntensity;
uniform float uDust;
uniform float uGrain;
uniform float uCursor;
uniform float uReveal;

out vec4 fragColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / uRes;
  float unit = min(uRes.x, uRes.y);
  vec2 p = frag / unit;
  vec2 size = uRes / unit;
  vec2 mouse = uMouse * size;
  float t = uTime;

  // The beam: from a window above the top-left, falling down and to the right, swaying very slowly
  float sway = sin(t * 0.07) * 0.035 + (uMouse.x - 0.5) * 0.08 * uCursor;
  vec2 dir = normalize(vec2(0.62 + sway, -1.0));
  vec2 origin = vec2(size.x * 0.08, size.y + 0.32);
  vec2 d = p - origin;
  float along = dot(d, dir);
  float across = dot(d, vec2(-dir.y, dir.x));
  float width = 0.2 + along * 0.24;
  // On load the shutters open: the beam starts as a sliver and widens to full, brightening as it goes
  float open = smoothstep(0.0, 1.0, uReveal);
  float reach = width * mix(0.04, 1.0, open);
  float shape = smoothstep(reach, reach * 0.3, abs(across)) * smoothstep(0.0, 0.35, along) * exp(-along * 0.5) * open;

  // The window's mullion and transom leave soft shadow bars inside the light
  float a = across / width;
  shape *= 1.0 - 0.5 * smoothstep(0.07, 0.0, abs(a));
  shape *= 1.0 - 0.35 * smoothstep(0.05, 0.0, abs(along - 0.85));

  // Haze, shafts and dust only exist inside the light, so pixels outside it skip that work entirely
  float beam = 0.0;
  float dust = 0.0;

  if (shape > 0.001) {
  // Drifting haze and long shafts give the light some body
  float haze = fbm(p * vec2(2.2, 3.0) + vec2(t * 0.03, -t * 0.045));
  float shafts = noise(vec2(across * 13.0, t * 0.12));
  beam = shape * (0.5 + 0.9 * haze) * (0.72 + 0.5 * shafts);

  // Dust motes, seen only where the light catches them
  for (int l = 0; l < 2; l++) {
    float fl = float(l);
    float scale = 22.0 + fl * 16.0;
    vec2 q = p * scale;
    q.y -= t * (0.35 + fl * 0.2);
    q.x += sin(t * 0.25 + fl * 2.0 + q.y * 0.08) * 0.6;
    vec2 id = floor(q);
    vec2 f = fract(q) - 0.5;
    float h = hash(id + fl * 13.1);
    vec2 offset = vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5;
    float r = length(f - offset * 0.7);
    float twinkle = 0.55 + 0.45 * sin(t * (0.8 + h * 2.0) + h * 30.0);
    dust += step(0.86, h) * smoothstep(mix(0.05, 0.12, h), 0.0, r) * twinkle * (1.0 - fl * 0.35);
  }
  dust *= smoothstep(0.02, 0.35, shape);
  }

  // A faint warm glow follows the pointer, like a work lamp being moved
  vec2 m = p - mouse;
  float glow = exp(-dot(m, m) * 7.0) * uCursor;

  vec3 col = uBase + uLight * (beam * uIntensity + dust * uDust * 0.5 + glow * 0.05);

  // Corners fall off, and grain breaks up banding in the near-black
  col *= mix(0.72, 1.0, smoothstep(1.25, 0.35, length((uv - 0.5) * vec2(1.2, 1.0))));
  col += (hash(frag + fract(t * 7.3) * 91.0) - 0.5) * uGrain;

  fragColor = vec4(col, 1.0);
}`

const compile = (gl: WebGL2RenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type)

  if (!shader) return null

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)

    return null
  }

  return shader
}

/**
 * Raw WebGL2 rather than three: one full-screen pass needs no scene graph. It pauses off screen and in
 * a hidden tab, draws one still frame under reduced motion, and leaves the CSS beam behind it on failure
 */
const WorkshopLight = ({ reduceMotion, finePointer, lit }: WorkshopLightProps) => {
  const { INTRO, SHADER } = useForge()

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null)

  /**
   * Read by the render loop rather than passed to the setup effect, so a flag settling after hydration
   * or the window opening never tears down and recompiles the WebGL program
   */
  const flagsRef = useRef({ reduceMotion, finePointer, lit })
  const syncRef = useRef<() => void>(() => { })

  useEffect(() => {
    flagsRef.current = { reduceMotion, finePointer, lit }
    syncRef.current()
  }, [reduceMotion, finePointer, lit])

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) return

    const flags = flagsRef
    let teardown = () => { }

    // Builds everything the beam needs; run again if the browser restores a lost context
    const setup = () => {
      const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power' })

      if (!gl) return () => { }

      const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX)
      const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
      const program = gl.createProgram()
      const vao = gl.createVertexArray()

      if (!vertex || !fragment || !program) return () => { }

      gl.attachShader(program, vertex)
      gl.attachShader(program, fragment)
      gl.linkProgram(program)

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        return () => { }
      }

      gl.useProgram(program)
      gl.bindVertexArray(vao)

      const at = (name: string) => gl.getUniformLocation(program, name)
      const uRes = at('uRes')
      const uTime = at('uTime')
      const uMouse = at('uMouse')
      const uReveal = at('uReveal')
      const uCursor = at('uCursor')

      gl.uniform3fv(at('uBase'), SHADER.base)
      gl.uniform3fv(at('uLight'), SHADER.light)
      gl.uniform1f(at('uIntensity'), SHADER.intensity)
      gl.uniform1f(at('uDust'), SHADER.dust)
      gl.uniform1f(at('uGrain'), SHADER.grain)

      // Pointer in 0–1 of the canvas, y up; eased every frame so the light moves like it has weight
      const target = { x: 0.3, y: 0.7 }
      const mouse = { ...target }
      const rect = { left: 0, top: 0, width: 1, height: 1 }
      let frame = 0
      let visible = true
      let last = performance.now()
      let time = 0
      let openedAt: number | null = null

      const resize = () => {
        const scale = Math.min(window.devicePixelRatio, 1.5) * SHADER.resolution
        const width = Math.max(1, Math.round(canvas.clientWidth * scale))
        const height = Math.max(1, Math.round(canvas.clientHeight * scale))

        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width
          canvas.height = height
          gl.viewport(0, 0, width, height)
        }

        gl.uniform2f(uRes, width, height)
      }

      // Re-read on resize, and on the next pointer move after a scroll, so scrolling itself never forces a layout read
      let stale = false

      const measure = () => {
        const box = canvas.getBoundingClientRect()

        stale = false

        rect.left = box.left
        rect.top = box.top
        rect.width = box.width || 1
        rect.height = box.height || 1
      }

      const markStale = () => {
        stale = true
      }

      const draw = (now: number) => {
        const { reduceMotion: still, finePointer: fine, lit: isLit } = flags.current

        time += Math.min(now - last, 50) * 0.001 * SHADER.speed
        last = now
        mouse.x += (target.x - mouse.x) * 0.04
        mouse.y += (target.y - mouse.y) * 0.04

        // The beam opens from the moment the hero is lit, not from page load
        if (isLit && openedAt === null) openedAt = time

        const opening = openedAt === null ? 0 : (time - openedAt) / (INTRO.beam * SHADER.speed)

        gl.uniform1f(uTime, still ? 12 : time)
        gl.uniform1f(uReveal, !INTRO.enabled || still ? 1 : Math.min(1, opening))
        gl.uniform1f(uCursor, fine && !still ? SHADER.cursor : 0)
        gl.uniform2f(uMouse, mouse.x, mouse.y)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }

      const loop = (now: number) => {
        draw(now)
        frame = requestAnimationFrame(loop)
      }

      const stop = () => {
        cancelAnimationFrame(frame)
        frame = 0
      }

      // Runs only while the hero is lit, on screen and in a visible tab; reduced motion gets one still frame
      const sync = () => {
        const { reduceMotion: still, lit: isLit } = flags.current
        const run = isLit && !still && visible && !document.hidden

        if (run && !frame) {
          last = performance.now()
          frame = requestAnimationFrame(loop)
        } else if (!run && frame) {
          stop()
        }

        if (!run) draw(performance.now())
      }

      const handlePointer = (event: PointerEvent) => {
        if (!flags.current.finePointer || flags.current.reduceMotion) return

        if (stale) measure()

        target.x = (event.clientX - rect.left) / rect.width
        target.y = 1 - (event.clientY - rect.top) / rect.height
      }

      const resizeObserver = new ResizeObserver(() => {
        resize()
        measure()

        if (!frame) draw(performance.now())
      })

      const viewObserver = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting
        sync()
      })

      resize()
      measure()
      draw(performance.now())
      canvas.dataset.ready = 'true'
      syncRef.current = sync
      sync()

      resizeObserver.observe(canvas)
      viewObserver.observe(canvas)
      document.addEventListener('visibilitychange', sync)
      window.addEventListener('scroll', markStale, { passive: true })
      window.addEventListener('pointermove', handlePointer, { passive: true })

      return () => {
        stop()
        syncRef.current = () => { }
        resizeObserver.disconnect()
        viewObserver.disconnect()
        document.removeEventListener('visibilitychange', sync)
        window.removeEventListener('scroll', markStale)
        window.removeEventListener('pointermove', handlePointer)
        gl.deleteVertexArray(vao)
        gl.deleteProgram(program)
        gl.deleteShader(vertex)
        gl.deleteShader(fragment)
      }
    }

    // A GPU reset or a backgrounded mobile tab can drop the context; keep it restorable and rebuild then
    const handleLost = (event: Event) => {
      event.preventDefault()
      teardown()
      teardown = () => { }
    }

    const handleRestored = () => {
      teardown = setup()
    }

    teardown = setup()
    canvas.addEventListener('webglcontextlost', handleLost)
    canvas.addEventListener('webglcontextrestored', handleRestored)

    return () => {
      teardown()
      canvas.removeEventListener('webglcontextlost', handleLost)
      canvas.removeEventListener('webglcontextrestored', handleRestored)
    }
  }, [])

  return (
    <div aria-hidden className='pointer-events-none absolute inset-0 -z-10 overflow-hidden'>
      <div className='fg-light-fallback absolute inset-0' />
      <canvas ref={canvasRef} className='fg-light-canvas absolute inset-0 size-full' />
    </div>
  )
}






// Each headline line rises out of its own mask, 0.12s after the one above
const lineReveal = (index: number, go: boolean) => ({
  initial: { y: '108%' },
  animate: { y: go ? '0%' : '108%' },
  transition: { delay: 0.2 + index * 0.12, duration: 0.8, ease: EASE_OUT }
})

const fadeUp = (delay: number, go: boolean) => ({
  initial: { opacity: 0, y: 14 },
  animate: go ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 },
  transition: { delay, duration: 0.6, ease: EASE_OUT }
})

/**
 * A headline line that rolls letter by letter when its text changes: old letters lift out, new ones rise
 * in. Each letter is also its own hover target, knocked down like a nail being driven
 */
const RollingLine = ({ text, delay }: { text: string; delay: number }) => {
  return (
    <AnimatePresence mode='wait' initial={false}>
      <m.span key={text} className='inline-block whitespace-nowrap'>
        {text.split('').map((char, index) => (
          <m.span
            key={`${char}-${index}`}
            initial={{ y: '110%' }}
            animate={{ y: '0%', transition: { delay: delay + index * 0.03, duration: 0.5, ease: EASE_OUT } }}
            exit={{ y: '-110%', transition: { delay: index * 0.02, duration: 0.26, ease: [0.55, 0, 1, 0.45] } }}
            className='inline-block'
          >
            {char === ' ' ? ' ' : <span className='fg-letter'>{char}</span>}
          </m.span>
        ))}
      </m.span>
    </AnimatePresence>
  )
}

type HeroCopyProps = {
  // The three title lines for the chosen job; the last is set in the accent
  lines: string[]

  // False while the splash is still forging the logo; the copy holds hidden until it hands over
  go: boolean
}

const HeroCopyBase = ({ lines, go }: HeroCopyProps) => {
  const { COPY } = useForge()

  // Vars
  const lastLine = lines.length - 1

  return (
    <div className='relative max-w-[600px]'>
      <m.p
        {...fadeUp(0.1, go)}
        className='font-fg-mono text-fg-grey flex items-center gap-3 text-[11.5px] tracking-[0.22em] uppercase'
      >
        <span aria-hidden className='bg-fg-accent h-px w-7' />
        {COPY.eyebrow}
      </m.p>

      <h1 className='fg-display text-fg-ink mt-6 lg:[@media(max-height:900px)]:mt-4'>
        <span className='sr-only'>{lines.join(' ')}</span>
        {lines.map((line, index) => (
          <span key={index} aria-hidden className='fg-mask block'>
            <m.span {...lineReveal(index, go)} className={cn('block', index === lastLine && 'text-fg-accent')}>
              <RollingLine text={line} delay={index * 0.09} />
            </m.span>
          </span>
        ))}
      </h1>

      <m.p
        {...fadeUp(0.9, go)}
        className='text-fg-grey mt-7 max-w-[30rem] text-[16px] leading-[1.6] text-pretty sm:text-[17px] lg:[@media(max-height:900px)]:mt-5'
      >
        {COPY.subtext}
      </m.p>

      <m.div
        {...fadeUp(1.02, go)}
        className='mt-9 flex flex-wrap items-center gap-2.5 xl:gap-3 lg:[@media(max-height:900px)]:mt-7'
      >
        <a
          href={COPY.primary.href}
          className='fg-focus fg-sheen group bg-fg-accent text-fg-on-accent hover:bg-fg-accent-deep relative inline-flex h-[52px] items-center gap-2.5 overflow-hidden rounded-[16px] pr-4 pl-5 text-[15px] font-semibold transition-[background-color,translate,box-shadow] duration-300 ease-(--fg-ease) hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-14px_rgba(255,129,77,0.7)] motion-reduce:hover:translate-y-0 xl:pr-5 xl:pl-6'
        >
          <span className='relative'>{COPY.primary.label}</span>
          <ArrowRight
            aria-hidden
            className='relative size-[18px] transition-transform duration-300 ease-(--fg-ease) group-hover:translate-x-[5px]'
          />
        </a>
        <a
          href={COPY.secondary.href}
          className='fg-focus border-fg-ink/45 text-fg-ink hover:bg-fg-ink hover:text-fg-page hover:border-fg-ink inline-flex h-[52px] items-center rounded-[16px] border px-5 text-[15px] font-medium transition-colors duration-300 ease-(--fg-ease) xl:px-6'
        >
          {COPY.secondary.label}
        </a>
      </m.div>
    </div>
  )
}


const HeroCopy = memo(HeroCopyBase)






type ProjectPickerProps = {
  active: ProjectId

  // The tool being pointed at on the board: every job that uses it shows a dot
  tool: ToolId | null
  onPick: (id: ProjectId) => void

  // Hovering a job previews its kit on the board without choosing it
  onPeek: (id: ProjectId | null) => void
}

// A radio group: one tab stop, arrow keys move the choice
const ProjectPicker = ({ active, tool, onPick, onPeek }: ProjectPickerProps) => {
  const { COPY, PROJECTS } = useForge()

  // Refs
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Vars
  const activeIndex = PROJECTS.findIndex(project => project.id === active)

  // Pointing at the chosen job ends any preview; pointing at another one previews it
  const handlePointerEnter = (event: ReactPointerEvent<HTMLButtonElement>, id: ProjectId) => {
    if (event.pointerType === 'mouse') onPeek(id === active ? null : id)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]

    if (!step) return

    event.preventDefault()

    const next = (activeIndex + step + PROJECTS.length) % PROJECTS.length

    onPick(PROJECTS[next].id)
    buttonRefs.current[next]?.focus()
  }

  return (
    <div className='flex flex-col gap-2.5 2xl:flex-row 2xl:items-center 2xl:justify-between'>
      <p className='font-fg-mono text-fg-grey shrink-0 text-[10.5px] tracking-[0.2em] uppercase'>{COPY.picker}</p>
      <div
        role='radiogroup'
        aria-label={COPY.picker}
        onKeyDown={handleKeyDown}
        onPointerLeave={() => onPeek(null)}
        className='fg-picker flex [scrollbar-width:none] gap-1 overflow-x-auto rounded-[14px] p-1'
      >
        {PROJECTS.map((project, index) => {
          const isActive = project.id === active
          const Icon = project.icon
          const usesTool = Boolean(tool) && project.id !== 'all' && project.tools.includes(tool as ToolId)

          return (
            <button
              key={project.id}
              ref={node => {
                buttonRefs.current[index] = node
              }}
              type='button'
              role='radio'
              aria-checked={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onPick(project.id)}
              onPointerEnter={event => handlePointerEnter(event, project.id)}
              className={cn(
                'fg-focus relative flex h-11 flex-1 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[10px] px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-300',
                isActive ? 'text-fg-on-accent' : 'text-fg-ink/70 hover:text-fg-ink'
              )}
            >
              {isActive && (
                <m.span
                  layoutId='fg-picker-pill'
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  className='bg-fg-accent absolute inset-0 rounded-[10px]'
                />
              )}
              <Icon aria-hidden className='relative size-4' strokeWidth={1.9} />
              <span className='relative'>{project.label}</span>
              <AnimatePresence>
                {usesTool && (
                  <m.span
                    aria-hidden
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                    className={cn(
                      'absolute top-1.5 right-1.5 size-1.5 rounded-full',
                      isActive ? 'bg-fg-on-accent' : 'bg-fg-accent'
                    )}
                  />
                )}
              </AnimatePresence>
            </button>
          )
        })}
      </div>
    </div>
  )
}







type BoardToolProps = {
  id: ToolId
  inKit: boolean
  active: boolean

  // Position in the kit, so the tools lift one after another rather than all at once
  order: number
  reduceMotion: boolean
  onToggle: (id: ToolId) => void
  onActive: (id: ToolId | null) => void
}


const LIFT_SPRING = { type: 'spring', stiffness: 260, damping: 24, mass: 0.7 } as const

/**
 * A tool cut out of the board photo and laid exactly over its own pixels. Out of the kit it is
 * invisible and the dimmed photo shows through; in the kit it lifts off the bench under the lamp
 */
const BoardToolBase = ({ id, inKit, active, order, reduceMotion, onToggle, onActive }: BoardToolProps) => {
  const { CATEGORIES, TOOLS, TOOL_IDS, toolImage, BOARD } = useForge()

  // Largest tool first: a tool's place in this list is how far up the stack it sits
  const BY_SIZE = [...TOOL_IDS].sort((a, b) => ((TOOLS[b]?.box?.[2] ?? 0) * (TOOLS[b]?.box?.[3] ?? 0)) - ((TOOLS[a]?.box?.[2] ?? 0) * (TOOLS[a]?.box?.[3] ?? 0)))

  // Vars
  const tool = TOOLS[id]
  if (!tool || !tool.box) return null
  const [left, top, width, height] = tool.box
  const labelBelow = top < 14

  // The tool's centre feeds the lamp shadow in index.css, so each shadow falls away from the light
  const style = {
    left: `${left}%`,
    top: `${top}%`,
    width: `${width}%`,
    height: `${height}%`,
    '--tx': left + width / 2,
    '--ty': top + height / 2,

    /**
     * Smaller tools stack above larger ones, so a tool lying inside a bigger one's box still takes the
     * click; the pointed-at tool sits above all of them, so its label is never drawn under a neighbour
     */
    zIndex: active ? 40 : 11 + BY_SIZE.indexOf(id)
  } as CSSProperties

  const lifted = inKit && !reduceMotion

  // The kit lifts one tool after another rather than all at once
  const delay = inKit && !reduceMotion ? order * 0.06 : 0
  const opacity = inKit || active ? 1 : 0
  const target = { opacity: active ? 1 : opacity, y: lifted ? -BOARD.lift : 0, scale: lifted ? BOARD.liftScale : 1 }
  const transition = { opacity: { duration: 0.35, delay, ease: EASE_OUT }, default: { ...LIFT_SPRING, delay } }

  return (
    <button
      type='button'
      aria-pressed={inKit}
      aria-label={tool.name}
      onClick={() => onToggle(id)}
      onPointerEnter={() => onActive(id)}
      onPointerLeave={() => onActive(null)}
      onFocus={() => onActive(id)}
      onBlur={() => onActive(null)}
      style={style}
      className="fg-tool fg-focus absolute cursor-pointer rounded-[10px] transition-[scale] duration-150 after:absolute after:-inset-2 after:content-[''] active:scale-[0.97]"
    >
      <m.img
        src={toolImage(id)}
        alt=''
        draggable={false}
        decoding='async'
        initial={false}
        animate={target}
        transition={transition}
        className={cn('pointer-events-none size-full select-none', inKit ? 'fg-lifted' : 'fg-preview')}
      />

      <AnimatePresence>
        {active && (
          <m.span
            initial={{ opacity: 0, y: labelBelow ? -4 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className={cn(
              'fg-tag pointer-events-none absolute left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full py-1.5 pr-3 pl-1.5 whitespace-nowrap',
              labelBelow ? 'top-[calc(100%+8px)]' : 'bottom-[calc(100%+8px)]'
            )}
          >
            <span
              className={cn(
                'grid size-5 place-items-center rounded-full',
                inKit ? 'bg-fg-accent text-fg-on-accent' : 'text-fg-ink bg-white/12'
              )}
            >
              {inKit ? <Check className='size-3' strokeWidth={3} /> : <Plus className='size-3' strokeWidth={3} />}
            </span>
            <span className='text-fg-ink text-[12.5px] font-semibold'>{tool.name}</span>
            <span className='font-fg-mono text-fg-grey text-[9.5px] tracking-[0.14em] uppercase'>
              {inKit ? 'In kit' : (CATEGORIES[tool.category]?.label ?? tool.category ?? '')}
            </span>
          </m.span>
        )}
      </AnimatePresence>
    </button>
  )
}


const BoardTool = memo(BoardToolBase)







type KitBoardProps = {
  project: ProjectId
  kit: ToolId[]

  // A job whose kit is shown while its tab is hovered, before it is chosen
  preview: ProjectType | null
  active: ToolId | null
  finePointer: boolean
  reduceMotion: boolean
  onToggle: (id: ToolId) => void
  onActive: (id: ToolId | null) => void

  // False while the splash is on; the bench photo comes up whole once it turns true
  opened: boolean
}

const RULER_MARKS = Array.from({ length: 11 }, (_, index) => index * 10)

const KitBoard = ({ project, kit, preview, active, finePointer, reduceMotion, onToggle, onActive, opened }: KitBoardProps) => {
  const { COPY, TOOLS, TOOL_IDS, ASSETS, BOARD, INTRO } = useForge()

  // Tools in reading order, top to bottom then left to right, so the Tab key moves across the bench naturally
  const ORDER = [...TOOL_IDS].sort((a, b) => ((TOOLS[a]?.box?.[1] ?? 0) - (TOOLS[b]?.box?.[1] ?? 0)) || ((TOOLS[a]?.box?.[0] ?? 0) - (TOOLS[b]?.box?.[0] ?? 0)))

  const BOARD_STYLE = {
    '--lx': BOARD.lampRest.x,
    '--ly': BOARD.lampRest.y,
    '--fg-reach': `${BOARD.shadowReach / 100}px`
  } as CSSProperties

  // Refs
  const boardRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef(0)
  const lampRef = useRef({ x: BOARD.lampRest.x, y: BOARD.lampRest.y })

  // Vars

  // Under All tools the photo stays in full light until something is picked; then it dims like any job
  const bright = (preview ? preview.id : project) === 'all' && kit.length === 0

  useEffect(() => () => cancelAnimationFrame(frameRef.current), [])

  // The lamp is written once per frame at most, however fast the pointer events arrive
  const moveLamp = (x: number, y: number) => {
    lampRef.current = { x, y }

    if (frameRef.current) return

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0
      boardRef.current?.style.setProperty('--lx', String(lampRef.current.x))
      boardRef.current?.style.setProperty('--ly', String(lampRef.current.y))
    })
  }

  // The lamp follows the pointer through two CSS variables, so moving it never renders React
  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!finePointer || reduceMotion) return

    const rect = event.currentTarget.getBoundingClientRect()

    moveLamp(((event.clientX - rect.left) / rect.width) * 100, ((event.clientY - rect.top) / rect.height) * 100)
  }

  const handlePointerLeave = () => {
    moveLamp(BOARD.lampRest.x, BOARD.lampRest.y)
  }

  return (
    <div className='fg-mat relative rounded-[22px] p-2 pt-7 pl-7 sm:p-2.5 sm:pt-8 sm:pl-8'>
      {/* Cutting-mat rulers along the top and left edge */}
      <div aria-hidden className='fg-ruler-x absolute top-2.5 right-2.5 left-8 h-5 sm:left-[42px]'>
        {RULER_MARKS.map(mark => (
          <span key={mark} className='absolute -translate-x-1/2' style={{ left: `${mark}%` }}>
            {mark / 10}
          </span>
        ))}
      </div>
      <div aria-hidden className='fg-ruler-y absolute top-8 bottom-2.5 left-2.5 w-5 sm:top-[42px]'>
        {RULER_MARKS.filter(mark => mark < 100).map(mark => (
          <span key={mark} className='absolute -translate-y-1/2' style={{ top: `${mark}%` }}>
            {mark / 10}
          </span>
        ))}
      </div>

      <div
        ref={boardRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={BOARD_STYLE}
        data-bright={bright || undefined}
        className='fg-board relative isolate aspect-[1600/1066] w-full overflow-hidden rounded-[14px]'
      >
        {/**
         * The whole bench pulls into focus at once, from a little larger and softer. It starts at a
         * sliver of opacity rather than none, so the browser can count it as the largest paint early
         */}
        {ASSETS.board && (
          <m.img
            initial={
              INTRO.enabled && !reduceMotion
                ? { opacity: 0.01, scale: INTRO.scale, filter: `blur(${INTRO.blur}px)` }
                : false
            }
            animate={
              opened || !INTRO.enabled
                ? { opacity: 1, scale: 1, filter: 'blur(0px)' }
                : { opacity: 0.01, scale: INTRO.scale, filter: `blur(${INTRO.blur}px)` }
            }
            transition={{ delay: INTRO.delay, duration: reduceMotion ? 0.4 : INTRO.reveal, ease: EASE_OUT }}
            src={ASSETS.board.large}
            srcSet={`${ASSETS.board.small} 960w, ${ASSETS.board.large} 1600w`}
            sizes='(min-width: 1024px) 55vw, calc(100vw - 104px)'
            alt={ASSETS.board.alt}
            width={ASSETS.board.width}
            height={ASSETS.board.height}
            decoding='async'
            className='fg-bench-photo absolute inset-0 size-full object-cover'
          />
        )}

        {/* Everything the job doesn't need falls into shadow; the kit is drawn back on top at full light */}
        <m.div
          aria-hidden
          initial={false}
          animate={{ opacity: bright ? 0 : kit.length ? BOARD.dim : 0.12 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          className='absolute inset-0 bg-[#0b0a09]'
        />
        <div aria-hidden className='fg-lamp pointer-events-none absolute inset-0' />

        {/* A band of light passes over the bench whenever the project changes */}
        {!reduceMotion && (
          <AnimatePresence initial={false}>
            <m.div
              key={project}
              aria-hidden
              initial={{ x: '-60%', opacity: 0.9 }}
              animate={{ x: '160%', opacity: 0 }}
              transition={{ duration: 1.1, ease: EASE_OUT }}
              className='fg-sweep pointer-events-none absolute inset-y-0 left-0 z-[24] w-1/2'
            />
          </AnimatePresence>
        )}

        {ORDER.map(id => (
          <BoardTool
            key={id}
            id={id}
            inKit={kit.includes(id)}
            active={active === id}
            order={kit.indexOf(id)}
            reduceMotion={reduceMotion}
            onToggle={onToggle}
            onActive={onActive}
          />
        ))}

        <AnimatePresence>
          {preview && (
            <m.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              className='font-fg-mono bg-fg-ink text-fg-page pointer-events-none absolute top-3 right-3 z-30 flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] tracking-[0.14em] uppercase'
            >
              <Eye aria-hidden className='size-3.5' />
              Preview · {preview.label} · {preview.tools.length} tools
            </m.p>
          )}
        </AnimatePresence>

        <AnimatePresence mode='wait' initial={false}>
          {opened && (
            <m.p
              key='hint'
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className='font-fg-mono pointer-events-none absolute bottom-3 left-3 z-[60] hidden items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-[10px] tracking-[0.14em] text-white/75 uppercase backdrop-blur-sm sm:flex'
            >
              <MousePointerClick aria-hidden className='size-3.5' />
              {COPY.hint}
            </m.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}







type KitDockProps = {
  project: ProjectType
  kit: ToolId[]
  customised: boolean
  onRemove: (id: ToolId) => void
  onReset: () => void
}

/**
 * The kit as a shopping list: what the board lifted, editable from here too, with the cart button
 * counting along. No prices, because the block has none it could vouch for
 */
const KitDockBase = ({ project, kit, customised, onRemove, onReset }: KitDockProps) => {
  const { TOOLS, toolImage } = useForge()

  // Vars
  const count = kit.length
  const label = `${count} ${count === 1 ? 'tool' : 'tools'}`

  return (
    <div className='fg-dock flex flex-col gap-4 rounded-[20px] p-3 sm:flex-row sm:items-center sm:gap-5 sm:pl-5'>
      <div className='min-w-0 shrink-0'>
        <p className='font-fg-mono text-fg-accent text-[10px] tracking-[0.18em] uppercase'>Your kit</p>
        {/* Read once per change; the rolling digits below are for the eye only */}
        <span className='sr-only' aria-live='polite'>
          {label} in your kit
        </span>
        <p aria-hidden className='text-fg-ink mt-1 flex items-center text-[15px] font-semibold'>
          {/* The count rolls like a tally counter as tools come and go */}
          <span className='relative inline-flex h-[1.25em] overflow-hidden tabular-nums'>
            <AnimatePresence mode='popLayout' initial={false}>
              <m.span
                key={count}
                initial={{ y: '100%' }}
                animate={{ y: '0%' }}
                exit={{ y: '-100%' }}
                transition={{ duration: 0.3, ease: EASE_OUT }}
                className='block'
              >
                {count}
              </m.span>
            </AnimatePresence>
          </span>
          &nbsp;{count === 1 ? 'tool' : 'tools'}&nbsp;·&nbsp;
          <span className='text-fg-grey truncate font-normal'>
            {project.id === 'all' ? 'Your picks' : customised ? 'Customised' : project.label}
          </span>
        </p>
      </div>

      <ul className='flex min-h-11 min-w-0 flex-1 [scrollbar-width:none] items-center gap-1 overflow-x-auto'>
        <AnimatePresence initial={false} mode='popLayout'>
          {kit.map(id => (
            <m.li
              key={id}
              layout
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className='shrink-0'
            >
              <button
                type='button'
                onClick={() => onRemove(id)}
                aria-label={TOOLS[id]?.name ? `Remove ${TOOLS[id].name} from your kit` : 'Remove tool from your kit'}
                title={TOOLS[id]?.name ?? id}
                className="fg-focus group relative grid size-9 cursor-pointer place-items-center rounded-[10px] bg-white/[0.06] transition-colors after:absolute after:-inset-1 after:content-[''] hover:bg-white/[0.12]"
              >
                <img
                  src={toolImage(id)}
                  alt=''
                  width={24}
                  height={24}
                  loading='lazy'
                  decoding='async'
                  className='size-6 object-contain'
                />
                <span className='bg-fg-ink text-fg-page absolute -top-1 -right-1 grid size-4 scale-0 place-items-center rounded-full transition-transform duration-200 group-hover:scale-100 group-focus-visible:scale-100'>
                  <X aria-hidden className='size-2.5' strokeWidth={3} />
                </span>
              </button>
            </m.li>
          ))}
        </AnimatePresence>
        {count === 0 && <li className='text-fg-grey text-[13px]'>Tap tools on the bench to build a kit.</li>}
      </ul>

      <div className='flex shrink-0 items-center gap-2'>
        {customised && (
          <button
            type='button'
            onClick={onReset}
            aria-label={`Reset to the ${project.label} kit`}
            className='fg-focus text-fg-grey hover:text-fg-ink grid size-11 cursor-pointer place-items-center rounded-[12px] transition-colors'
          >
            <RotateCcw aria-hidden className='size-4' />
          </button>
        )}
        <button
          type='button'
          disabled={count === 0}
          className='fg-focus fg-sheen group bg-fg-accent text-fg-on-accent hover:bg-fg-accent-deep relative inline-flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-[12px] px-5 text-[14px] font-semibold transition-colors duration-300 disabled:pointer-events-none disabled:opacity-40 sm:flex-none'
        >
          <span className='relative'>Add {label} to cart</span>
          <ArrowRight
            aria-hidden
            className='relative size-4 transition-transform duration-300 group-hover:translate-x-1'
          />
        </button>
      </div>
    </div>
  )
}


const KitDock = memo(KitDockBase)







type Stage = 'dark' | 'forge' | 'handoff' | 'skip' | 'done'

// Strike time of each letter, and the moment its hammer blow lands (a third of the way into the strike)
const STRIKE = 0.42

// The full stop falls after the last letter and lands as the ember
const DOT_DROP = 0.48

const splashTimings = (name: string, splash: { firstStrike: number; strikeEvery: number; hold: number }) => {
  const LETTERS = name.split('')
  const strikeAt = (index: number) => splash.firstStrike + index * splash.strikeEvery
  const impactAt = (index: number) => strikeAt(index) + STRIKE * 0.35
  const DOT_AT = strikeAt(LETTERS.length) + 0.06
  const DOT_IMPACT = DOT_AT + DOT_DROP
  const HANDOFF_AT = DOT_IMPACT + splash.hold

  return { LETTERS, strikeAt, impactAt, DOT_AT, DOT_IMPACT, HANDOFF_AT }
}

// Metal cooling: white-hot, orange, the brand accent, then the ink of the finished logo
const COOLING = ['#FFF6DD', '#FFC285', '#FF814D', '#F5F3EF']

const GLOW = [
  '0 0 34px rgba(255,190,120,0.95)',
  '0 0 22px rgba(255,129,77,0.6)',
  '0 0 8px rgba(255,129,77,0.2)',
  '0 0 0 rgba(255,129,77,0)'
]

// Same sparks on every load: a seeded hash instead of Math.random, which would also break hydration
const rand = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453

  return x - Math.floor(x)
}

const sparksFor = (seed: number, count: number) =>
  Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI * (0.1 + 0.8 * rand(seed * 31 + i))
    const speed = 50 + 90 * rand(seed * 17 + i * 3)

    // Rounded, so the server and the browser print the same inline sizes
    const round = (value: number) => Math.round(value * 10) / 10

    return {
      x: round(Math.cos(angle) * speed),
      y: round(Math.sin(angle) * speed),
      fall: round(30 + 50 * rand(seed * 7 + i * 11)),
      size: round(2 + 2.5 * rand(seed * 5 + i)),
      duration: round(0.55 + 0.35 * rand(seed * 13 + i * 5))
    }
  })

type SparkType = ReturnType<typeof sparksFor>[number]

/**
 * One spark thrown from its strike: a single compositor animation of opacity and transform, held at its
 * first keyframe (invisible) until its delay has passed
 */
const Spark = ({ spark, at, go }: { spark: SparkType; at: number; go: boolean }) => {
  // Refs
  const sparkRef = useRef<HTMLSpanElement>(null)
  const animationRef = useRef<Animation | null>(null)

  useEffect(() => {
    const node = sparkRef.current

    if (!go || !node || animationRef.current) return

    const easing = 'ease-out'

    animationRef.current = node.animate(
      [
        { opacity: 0, transform: 'translate(0px, 0px)', offset: 0, easing },
        { opacity: 1, transform: 'translate(0px, 0px)', offset: 0.02, easing },
        { opacity: 1, transform: `translate(${spark.x * 0.6}px, ${spark.y * 0.6}px)`, offset: 0.4, easing },
        { opacity: 0, transform: `translate(${spark.x}px, ${spark.y + spark.fall}px)`, offset: 1 }
      ],
      { duration: spark.duration * 1000, delay: at * 1000, fill: 'both' }
    )
  }, [go, spark, at])

  // Only a real unmount stops it, so a skip leaves the spark to fade with the splash around it
  useEffect(() => {
    return () => {
      animationRef.current?.cancel()
      animationRef.current = null
    }
  }, [])

  return (
    <span
      ref={sparkRef}
      style={{ opacity: 0, width: spark.size, height: spark.size }}
      className='fg-spark absolute rounded-full'
    />
  )
}

const Sparks = ({ seed, count, at, go }: { seed: number; count: number; at: number; go: boolean }) => {
  return (
    <span aria-hidden className='pointer-events-none absolute bottom-[0.1em] left-1/2 size-0'>
      {sparksFor(seed, count).map((spark, index) => (
        <Spark key={index} spark={spark} at={at} go={go} />
      ))}
    </span>
  )
}

/**
 * A splash that is the logo being made: it never shows anything the page does not keep, because the
 * finished wordmark flies into the nav and becomes the logo there
 */
const ForgeSplash = () => {
  const { BRAND, COPY, SPLASH } = useForge()

  // States
  const [stage, setStage] = useState<Stage>('dark')

  // Refs
  const rootRef = useRef<HTMLDivElement>(null)
  const wordRef = useRef<HTMLDivElement>(null)
  const shakeX = useMotionValue(0)
  const openedRef = useRef(false)
  const skipRef = useRef<() => void>(() => { })

  // Hooks
  const reduceMotion = useReducedPreference()

  // The hero opens underneath the moment the wordmark starts its flight
  const { open: openHero } = useOpening()

  // Vars
  const { LETTERS, strikeAt, impactAt, DOT_AT, DOT_IMPACT, HANDOFF_AT } = splashTimings(BRAND.name, SPLASH)
  const go = stage === 'forge' || stage === 'handoff'

  useEffect(() => {
    const root = rootRef.current?.closest<HTMLElement>('.fg-root')
    const timers: number[] = []
    const later = (seconds: number, run: () => void) => timers.push(window.setTimeout(run, seconds * 1000))

    // Once the hero has been handed over, the splash never starts again, whatever re-runs this effect
    if (openedRef.current) return

    let cancelled = false

    const open = () => {
      if (openedRef.current) return

      openedRef.current = true
      openHero()
    }

    const finish = () => {
      root?.removeAttribute('data-splash')
      setStage('done')
    }

    let seen = false

    try {
      seen = SPLASH.oncePerSession && sessionStorage.getItem(SPLASH.storageKey) === '1'
    } catch {
      seen = false
    }

    // Small screens are marked before the first paint (see index.tsx); the query covers client navigation
    const skipped =
      (root?.hasAttribute('data-nosplash') ?? false) ||
      window.matchMedia(`(max-width: ${SPLASH.skipBelow - 0.02}px)`).matches

    if (reduceMotion || seen || skipped) {
      later(0, () => {
        open()
        finish()
      })

      return () => timers.forEach(timer => window.clearTimeout(timer))
    }

    root?.setAttribute('data-splash', 'on')

    let handed = false

    // The wordmark flies to wherever the nav logo really is, so it lands on it at any screen size
    const handoff = () => {
      if (handed) return

      handed = true
      const word = wordRef.current
      const logo = root?.querySelector<HTMLElement>('.fg-logo')

      setStage('handoff')
      open()

      try {
        sessionStorage.setItem(SPLASH.storageKey, '1')
      } catch {
        // Storage can be blocked; the splash just shows again next time
      }

      if (!word || !logo) {
        later(0.4, finish)

        return
      }

      const from = word.getBoundingClientRect()
      const to = logo.getBoundingClientRect()

      animate(
        word,
        { x: [0, to.left - from.left], y: [0, to.top - from.top], scale: [1, to.height / from.height] },
        { duration: SPLASH.flight, ease: [0.7, 0, 0.2, 1] }
      ).then(finish)
    }

    // A hammer blow jolts the whole frame by a couple of pixels
    const jolt = (strength: number) => {
      animate(shakeX, [0, -strength, strength * 0.6, 0], { duration: 0.16 })
    }

    const begin = () => {
      setStage('forge')
      LETTERS.forEach((_, index) => later(impactAt(index), () => jolt(2)))
      later(DOT_IMPACT, () => jolt(3.5))
      later(HANDOFF_AT, handoff)
    }

    // Wait for the brand font, so the letters are struck in Archivo rather than swapped in mid-strike
    let started = false

    const start = () => {
      if (started) return

      started = true
      begin()
    }

    // The fonts promise outlives this effect, so a stale run must not start a second forge
    document.fonts.ready.then(() => !cancelled && start())
    later(0.7, start)

    // Any key or click skips: the splash simply fades, since a half-struck word should not fly anywhere
    const handleSkip = () => {
      if (handed) return

      handed = true
      started = true
      timers.forEach(timer => window.clearTimeout(timer))
      timers.length = 0
      setStage('skip')
      open()
      later(0.35, finish)
    }

    skipRef.current = handleSkip
    window.addEventListener('keydown', handleSkip, { once: true })

    return () => {
      cancelled = true
      timers.forEach(timer => window.clearTimeout(timer))
      window.removeEventListener('keydown', handleSkip)
      root?.removeAttribute('data-splash')
    }
  }, [reduceMotion, openHero, shakeX])

  if (stage === 'done') return null

  return (
    <div
      ref={rootRef}
      aria-hidden
      onPointerDown={() => skipRef.current()}
      className='fg-splash fixed inset-0 z-[100] grid cursor-pointer place-items-center'
    >
      {/* The dark lifts as the wordmark leaves, uncovering the hero already opening underneath */}
      <m.div
        aria-hidden
        initial={{ opacity: 1 }}
        animate={{ opacity: stage === 'handoff' || stage === 'skip' ? 0 : 1 }}
        transition={{ duration: stage === 'skip' ? 0.3 : SPLASH.flight * 0.85, ease: 'easeInOut' }}
        className='bg-fg-page absolute inset-0'
      />

      {/* Heat that builds with every strike and dies with the hand-off */}
      <m.div
        aria-hidden
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: stage === 'forge' ? 1 : 0, scale: stage === 'forge' ? 1 : 1.2 }}
        transition={{ duration: stage === 'forge' ? HANDOFF_AT : 0.5, ease: 'easeOut' }}
        className='fg-splash-heat absolute size-[70vmin] rounded-full'
      />

      <m.div
        style={{ x: shakeX }}
        animate={{ opacity: stage === 'skip' ? 0 : 1 }}
        transition={{ duration: 0.2 }}
        className='relative flex flex-col items-center'
      >
        <div ref={wordRef} className='fg-logo fg-splash-word text-fg-ink relative flex origin-top-left leading-none'>
          {/* The anvil: a faint line the letters are struck against */}
          <m.span
            aria-hidden
            initial={{ opacity: 0, scaleX: 0.4 }}
            animate={{ opacity: stage === 'forge' ? 1 : 0, scaleX: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className='absolute inset-x-[-6%] bottom-[0.02em] h-px bg-white/15'
          />

          {LETTERS.map((letter, index) => (
            <span key={index} className='relative inline-block'>
              <m.span
                initial={{ opacity: 0 }}
                animate={
                  go
                    ? {
                      opacity: 1,
                      y: ['-0.32em', '0em', '0em'],
                      scaleY: [1.1, 0.82, 1],
                      scaleX: [0.94, 1.14, 1],
                      color: COOLING,
                      textShadow: GLOW
                    }
                    : { opacity: 0 }
                }
                transition={{
                  opacity: { duration: 0.05, delay: strikeAt(index) },
                  y: { duration: STRIKE, delay: strikeAt(index), times: [0, 0.35, 1], ease: 'easeOut' },
                  scaleY: { duration: STRIKE, delay: strikeAt(index), times: [0, 0.35, 1] },
                  scaleX: { duration: STRIKE, delay: strikeAt(index), times: [0, 0.35, 1] },
                  color: { duration: 1.3, delay: strikeAt(index) + 0.1, times: [0, 0.2, 0.55, 1] },
                  textShadow: { duration: 1.3, delay: strikeAt(index) + 0.1, times: [0, 0.2, 0.55, 1] }
                }}
                className='inline-block origin-bottom'
              >
                {letter === ' ' ? '\u00A0' : letter}
              </m.span>

              {/* A flash on the anvil where the blow lands */}
              {letter !== ' ' && (
                <>
                  <m.span
                    aria-hidden
                    initial={{ opacity: 0 }}
                    animate={go ? { opacity: [0, 1, 0] } : { opacity: 0 }}
                    transition={{ duration: 0.5, delay: impactAt(index), times: [0, 0.15, 1] }}
                    className='fg-splash-flash absolute inset-x-[-25%] bottom-[-0.08em] h-[0.16em]'
                  />
                  <Sparks seed={index + 1} count={SPLASH.sparks} at={impactAt(index)} go={go} />
                </>
              )}
            </span>
          ))}

          {/* The full stop falls last, molten, and stays lit as the brand's ember */}
          <span className='relative inline-block'>
            <m.span
              initial={{ opacity: 0 }}
              animate={go ? { opacity: 1, y: ['-1.6em', '0em', '-0.06em', '0em'] } : { opacity: 0 }}
              transition={{
                opacity: { duration: 0.05, delay: DOT_AT },
                y: { duration: DOT_DROP + 0.2, delay: DOT_AT, times: [0, 0.7, 0.85, 1], ease: 'easeIn' }
              }}
              className='fg-ember text-fg-accent inline-block'
            >
              .
            </m.span>
            <Sparks seed={99} count={SPLASH.sparks * 2} at={DOT_IMPACT} go={go} />
          </span>
        </div>

        <m.p
          initial={{ opacity: 0, letterSpacing: '0.5em' }}
          animate={{
            opacity: stage === 'forge' ? 1 : 0,
            letterSpacing: stage === 'forge' ? '0.32em' : '0.5em'
          }}
          transition={{ duration: stage === 'forge' ? 0.9 : 0.25, delay: stage === 'forge' ? DOT_IMPACT - 0.1 : 0 }}
          className='font-fg-mono text-fg-grey absolute top-[calc(100%+28px)] text-[11px] whitespace-nowrap uppercase'
        >
          {COPY.eyebrow}
        </m.p>
      </m.div>
    </div>
  )
}






const panelMotion = {
  initial: { opacity: 0, y: -6, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.98 },
  transition: { duration: 0.22, ease: EASE_OUT }
}

// The hit area grows through a pseudo-element, so the box the splash flies into keeps the text's size
const Logo = () => {
  const { BRAND } = useForge()

  return (
    <a
      href={BRAND.href}
      className="fg-focus fg-logo text-fg-ink relative rounded-md text-[25px] leading-none after:absolute after:-inset-x-1 after:-inset-y-[10px] after:content-['']"
    >
      {BRAND.name}
      <span className='fg-ember text-fg-accent inline-block'>.</span>
    </a>
  )
}

const CategoryList = ({ onPick }: { onPick?: () => void }) => {
  const { CATEGORIES, CATEGORY_ORDER } = useForge()

  return (
    <ul className='grid gap-0.5'>
      {CATEGORY_ORDER.map(id => {
        const category = CATEGORIES[id]
        if (!category) return null
        const Icon = category.icon

        return (
          <li key={id}>
            <a
              href={category.href}
              onClick={onPick}
              className='fg-focus group hover:bg-fg-ink/[0.06] flex items-center gap-3 rounded-[12px] p-2 transition-colors'
            >
              <span className='bg-fg-ink/[0.06] text-fg-ink group-hover:bg-fg-accent group-hover:text-fg-on-accent grid size-9 shrink-0 place-items-center rounded-[10px] transition-colors duration-300'>
                <Icon aria-hidden className='size-[17px]' strokeWidth={1.75} />
              </span>
              <span className='min-w-0 flex-1'>
                <span className='text-fg-ink block text-[14px] font-medium'>{category.label}</span>
                <span className='text-fg-grey block truncate text-[12.5px]'>{category.blurb}</span>
              </span>
              <ArrowRight
                aria-hidden
                className='text-fg-grey size-4 shrink-0 transition-transform duration-300 group-hover:translate-x-1'
              />
            </a>
          </li>
        )
      })}
    </ul>
  )
}

const CategoriesMenu = () => {
  // States
  const [open, setOpen] = useState(false)

  // Refs
  const rootRef = useRef<HTMLLIElement>(null)
  const timer = useRef(0)

  useEffect(() => {
    if (!open) return

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        rootRef.current?.querySelector('button')?.focus()
      }
    }

    const handlePress = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }

    window.addEventListener('keydown', handleKey)
    document.addEventListener('pointerdown', handlePress)

    return () => {
      window.removeEventListener('keydown', handleKey)
      document.removeEventListener('pointerdown', handlePress)
    }
  }, [open])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  /**
   * A mouse opens and closes it with a short delay, so crossing the menu on the way elsewhere does
   * nothing; touch ignores these, since a tap fires a pointer leave straight after it lands
   */
  const handleEnter = (event: ReactPointerEvent) => {
    if (event.pointerType !== 'mouse') return

    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(true), 90)
  }

  const handleLeave = (event: ReactPointerEvent) => {
    if (event.pointerType !== 'mouse') return

    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(false), 180)
  }

  // A mouse that hovered it open keeps it open on click; keyboard and touch toggle it
  const handleClick = (event: ReactMouseEvent) => {
    window.clearTimeout(timer.current)

    if (event.detail > 0 && matchMedia('(hover: hover)').matches) setOpen(true)
    else setOpen(value => !value)
  }

  // Tabbing out of the menu closes it
  const handleBlur = (event: FocusEvent<HTMLLIElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
  }

  return (
    <li
      ref={rootRef}
      className='relative'
      onPointerEnter={handleEnter}
      onPointerLeave={handleLeave}
      onBlur={handleBlur}
    >
      <button
        type='button'
        aria-expanded={open}
        aria-controls={open ? 'fg-categories' : undefined}
        onClick={handleClick}
        className='fg-focus fg-underline text-fg-ink/75 hover:text-fg-ink aria-expanded:text-fg-ink flex cursor-pointer items-center gap-1 rounded-md py-2 text-[14.5px] font-medium transition-colors'
      >
        Categories
        <ChevronDown aria-hidden className={cn('size-3.5 transition-transform duration-300', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <m.div
            id='fg-categories'
            {...panelMotion}
            className='fg-panel absolute top-full left-1/2 z-50 mt-3 w-[340px] origin-top -translate-x-1/2 rounded-[18px] p-2'
          >
            <CategoryList onPick={() => setOpen(false)} />
            <a
              href='#categories'
              className='fg-focus text-fg-accent border-fg-line mt-1 flex items-center justify-between border-t px-2 pt-3 pb-1.5 text-[13px] font-semibold'
            >
              All categories
              <ArrowRight aria-hidden className='size-4' />
            </a>
          </m.div>
        )}
      </AnimatePresence>
    </li>
  )
}

const SearchField = () => {
  const { NAV } = useForge()

  // States
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  // Refs
  const inputRef = useRef<HTMLInputElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Hooks
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!open) {
      event.preventDefault()
      setOpen(true)

      return
    }

    if (!query.trim()) event.preventDefault()
  }

  // An empty field folds away when focus leaves it; a typed query stays visible
  const handleBlur = () => {
    if (!query) setOpen(false)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape') return

    setQuery('')
    setOpen(false)
    buttonRef.current?.focus()
  }

  return (
    <form
      role='search'
      action={NAV.search.action}
      onSubmit={handleSubmit}
      data-open={open || undefined}
      className='fg-search-form flex items-center'
    >
      <m.div
        initial={false}
        animate={{ width: open ? 'auto' : 44 }}
        transition={{ duration: reduceMotion ? 0 : 0.35, ease: EASE_OUT }}
        className={cn(
          'focus-within:border-fg-accent flex h-11 items-center overflow-hidden rounded-[12px] border transition-colors duration-300',
          open ? 'border-fg-line bg-[rgba(30,29,28,0.6)]' : 'border-transparent'
        )}
      >
        <button
          ref={buttonRef}
          type='submit'
          aria-label={open ? 'Search' : 'Open search'}
          className='fg-focus text-fg-ink/80 hover:text-fg-ink grid size-11 shrink-0 cursor-pointer place-items-center rounded-[12px] transition-colors'
        >
          <Search aria-hidden className='size-[19px]' strokeWidth={1.75} />
        </button>
        <input
          ref={inputRef}
          type='search'
          name='q'
          value={query}
          tabIndex={open ? 0 : -1}
          aria-hidden={!open}
          aria-label='Search products'
          placeholder={NAV.search.placeholder}
          onChange={event => setQuery(event.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={cn(
            'fg-search text-fg-ink placeholder:text-fg-grey/80 h-full bg-transparent pr-3 text-[14px] outline-none',
            open ? 'w-[112px] sm:w-[200px] xl:w-[230px]' : 'w-0'
          )}
        />
      </m.div>
    </form>
  )
}

/**
 * Page-level and sticky, outside the hero panel; the hero slides up underneath it so the bar can sit
 * transparently over the scene until the page moves
 */
const Navbar = () => {
  const { NAV } = useForge()

  // States
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  // Refs
  const headerRef = useRef<HTMLElement>(null)

  // The hero tucks under the bar by exactly its height, so the real height is written where the hero reads it
  useEffect(() => {
    const header = headerRef.current
    const root = header?.closest<HTMLElement>('.fg-root')

    if (!header || !root) return

    const measure = () => root.style.setProperty('--fg-nav-space', `${header.getBoundingClientRect().height}px`)
    const observer = new ResizeObserver(measure)

    observer.observe(header)
    document.fonts.ready.then(measure)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > NAV.frostAfter)

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (!menuOpen) return

    const desktop = window.matchMedia('(min-width: 1024px)')

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    const handleResize = () => {
      if (desktop.matches) setMenuOpen(false)
    }

    window.addEventListener('keydown', handleKey)
    desktop.addEventListener('change', handleResize)

    return () => {
      window.removeEventListener('keydown', handleKey)
      desktop.removeEventListener('change', handleResize)
    }
  }, [menuOpen])

  return (
    <header ref={headerRef} data-scrolled={scrolled || menuOpen} className='fg-nav sticky top-0 z-40'>
      <m.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
        className='fg-inset'
      >
        <nav aria-label='Main' className='fg-container relative flex h-[76px] items-center gap-6'>
          <Logo />

          <ul className='absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 lg:flex'>
            {NAV.links.map(link =>
              link.menu ? (
                <CategoriesMenu key={link.label} />
              ) : (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className='fg-focus fg-underline text-fg-ink/75 hover:text-fg-ink block rounded-md py-2 text-[14.5px] font-medium transition-colors'
                  >
                    {link.label}
                  </a>
                </li>
              )
            )}
          </ul>

          <div className='ml-auto flex items-center gap-1'>
            <SearchField />
            <a
              href={NAV.account.href}
              aria-label={NAV.account.label}
              className='fg-focus text-fg-ink/80 hover:text-fg-ink hidden size-11 place-items-center rounded-[12px] transition-colors sm:grid'
            >
              <User aria-hidden className='size-[19px]' strokeWidth={1.75} />
            </a>
            <a
              href={NAV.cart.href}
              aria-label={NAV.cart.label}
              className='fg-focus group text-fg-ink/80 hover:text-fg-ink grid size-11 place-items-center rounded-[12px] transition-colors'
            >
              <ShoppingCart
                aria-hidden
                className='size-[19px] transition-transform duration-300 ease-(--fg-ease) group-hover:scale-[1.12]'
                strokeWidth={1.75}
              />
            </a>
            <button
              type='button'
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? 'fg-menu' : undefined}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen(value => !value)}
              className='fg-focus border-fg-line text-fg-ink ml-1 grid size-11 cursor-pointer place-items-center rounded-[12px] border lg:hidden'
            >
              {menuOpen ? <X aria-hidden className='size-5' /> : <Menu aria-hidden className='size-5' />}
            </button>
          </div>
        </nav>
      </m.div>

      <AnimatePresence>
        {menuOpen && (
          <m.div
            id='fg-menu'
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: EASE_OUT }}
            className='fg-inset overflow-hidden lg:hidden'
          >
            <div className='fg-container border-fg-line border-t pt-3 pb-6'>
              <ul className='grid'>
                {NAV.links
                  .filter(link => !link.menu)
                  .map(link => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        onClick={() => setMenuOpen(false)}
                        className='fg-focus text-fg-ink flex min-h-12 items-center rounded-md text-[17px] font-medium'
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
              </ul>
              <p className='font-fg-mono text-fg-grey mt-4 mb-2 text-[10.5px] tracking-[0.18em] uppercase'>
                Categories
              </p>
              <CategoryList onPick={() => setMenuOpen(false)} />
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </header>
  )
}










const TRUST_ICONS = [BadgeCheck, ShieldCheck, Headphones]

const TrustRow = () => {
  const { COPY } = useForge()

  return (
    <ul className='text-fg-grey flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px]'>
      {COPY.trust.map((item, index) => {
        const Icon = TRUST_ICONS[index % TRUST_ICONS.length]

        return (
          <li key={item} className='flex items-center gap-1.5'>
            <Icon aria-hidden className='text-fg-accent size-[15px]' strokeWidth={1.75} />
            {item}
          </li>
        )
      })}
    </ul>
  )
}

// Entrances wait for the splash to hand over; until then they hold their starting pose
const reveal = (delay: number, go: boolean) => ({
  initial: { opacity: 0, y: 18 },
  animate: go ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 },
  transition: { delay, duration: 0.7, ease: EASE_OUT }
})

const HeroSection = () => {
  const { PROJECTS, DEFAULT_PROJECT, INTRO } = useForge()

  // States
  const [projectId, setProjectId] = useState<ProjectId>(DEFAULT_PROJECT)
  const [kit, setKit] = useState<ToolId[]>(PROJECTS.find(item => item.id === DEFAULT_PROJECT)?.tools ?? [])
  const [active, setActive] = useState<ToolId | null>(null)
  const [peek, setPeek] = useState<ProjectId | null>(null)

  // Hooks

  // Read through a hydration-safe query: the first client render matches the server, then updates
  const reduceMotion = useReducedPreference()
  const finePointer = useMediaQuery('(hover: hover) and (pointer: fine)')

  // False while the splash is forging the logo; everything in the hero starts when it hands over
  const { opened } = useOpening()

  // Vars
  const project = PROJECTS.find(item => item.id === projectId) ?? PROJECTS[0]
  const customised = kit.length !== project.tools.length || kit.some(id => !project.tools.includes(id))
  const preview = peek ? (PROJECTS.find(item => item.id === peek) ?? null) : null

  const handlePick = (id: ProjectId) => {
    const next = PROJECTS.find(item => item.id === id)

    if (!next) return

    setProjectId(id)
    setKit(next.tools)
    setPeek(null)
  }

  // Stable across renders, so hovering one tool does not re-render every tool and the kit dock
  const handleToggle = useCallback((id: ToolId) => {
    setKit(current => (current.includes(id) ? current.filter(item => item !== id) : [...current, id]))
  }, [])

  const handleRemove = useCallback((id: ToolId) => {
    setKit(current => current.filter(item => item !== id))
  }, [])

  const handleReset = useCallback(() => {
    setKit(project.tools)
  }, [project.tools])

  return (
    <section aria-label='Build your kit' className='fg-hero relative isolate'>
      <WorkshopLight reduceMotion={reduceMotion} finePointer={finePointer} lit={opened} />
      <div className='fg-inset'>
        <div className='fg-container grid grid-cols-[minmax(0,1fr)] gap-10 pt-[calc(var(--fg-nav-space)+28px)] pb-10 lg:min-h-[100svh] lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.55fr)] lg:items-center lg:gap-12 lg:pt-[calc(var(--fg-nav-space)+12px)] lg:pb-8 xl:gap-16'>
          <div className='flex min-w-0 flex-col'>
            <HeroCopy go={opened} lines={project.title} />
            <m.div {...reveal(1.15, opened)} className='mt-12 hidden lg:block lg:[@media(max-height:900px)]:mt-9'>
              <TrustRow />
            </m.div>
          </div>

          {/* On wide but short screens the board is sized from the height, so the whole bench always fits one screen */}
          <div className='flex w-full min-w-0 flex-col gap-3.5 lg:ml-auto lg:max-w-[calc((100svh-var(--fg-nav-space)-262px)*1.5+38px)] 2xl:max-w-[calc((100svh-var(--fg-nav-space)-232px)*1.5+38px)]'>
            <m.div {...reveal(0.35, opened)}>
              <ProjectPicker active={projectId} tool={active} onPick={handlePick} onPeek={setPeek} />
            </m.div>
            <m.div {...reveal(0.5, opened)} className='fg-bench-reveal'>
              <KitBoard
                project={projectId}
                kit={preview ? preview.tools : kit}
                preview={preview}
                active={active}
                finePointer={finePointer}
                reduceMotion={reduceMotion}
                onToggle={handleToggle}
                onActive={setActive}
                opened={opened}
              />
            </m.div>
            <m.div {...reveal(INTRO.enabled ? INTRO.delay + INTRO.reveal * 0.6 : 0.7, opened)}>
              <KitDock
                project={project}
                kit={kit}
                customised={customised}
                onRemove={handleRemove}
                onReset={handleReset}
              />
            </m.div>
          </div>

          <div className='lg:hidden'>
            <TrustRow />
          </div>
        </div>
      </div>
    </section>
  )
}


// The visitor's reduced-motion setting, unless the reducedMotion prop forces it
const useReducedPreference = () => {
  const { REDUCED } = useForge()
  const system = useMediaQuery('(prefers-reduced-motion: reduce)')

  return REDUCED ?? system
}

/* ----------------------------- Root ----------------------------- */

const BLOCK_CSS = `/* Theme roles (the block's @theme inline): colours resolve from the --fg-* variables the root writes from the theme prop */
[data-slot='forge'] {
  --font-fg-sans: 'Archivo', ui-sans-serif, system-ui, sans-serif;
  --font-fg-mono: 'Geist Mono', ui-monospace, 'SFMono-Regular', monospace;
}

/* The utilities the block's @theme generated (bg-fg-page, text-fg-ink, border-fg-line, font-fg-sans, ...), defined here because the host's Tailwind does not know these tokens */
@layer utilities {
  .border-fg-ink\\/45 {
    border-color: var(--fg-ink);
    @supports (color: color-mix(in lab, red, red)) {
      border-color: color-mix(in oklab, var(--fg-ink) 45%, transparent);
    }
  }
  .border-fg-line {
    border-color: var(--fg-line);
  }
  .bg-fg-accent {
    background-color: var(--fg-accent);
  }
  .bg-fg-ink {
    background-color: var(--fg-ink);
  }
  .bg-fg-ink\\/\\[0\\.06\\] {
    background-color: var(--fg-ink);
    @supports (color: color-mix(in lab, red, red)) {
      background-color: color-mix(in oklab, var(--fg-ink) 6%, transparent);
    }
  }
  .bg-fg-on-accent {
    background-color: var(--fg-onAccent);
  }
  .bg-fg-page {
    background-color: var(--fg-page);
  }
  .pt-\\[calc\\(var\\(--fg-nav-space\\)\\+28px\\)\\] {
    padding-top: calc(var(--fg-nav-space) + 28px);
  }
  .font-fg-mono {
    font-family: 'Geist Mono', ui-monospace, 'SFMono-Regular', monospace;
  }
  .font-fg-sans {
    font-family: 'Archivo', ui-sans-serif, system-ui, sans-serif;
  }
  .text-fg-accent {
    color: var(--fg-accent);
  }
  .text-fg-grey {
    color: var(--fg-grey);
  }
  .text-fg-ink {
    color: var(--fg-ink);
  }
  .text-fg-ink\\/70 {
    color: var(--fg-ink);
    @supports (color: color-mix(in lab, red, red)) {
      color: color-mix(in oklab, var(--fg-ink) 70%, transparent);
    }
  }
  .text-fg-ink\\/75 {
    color: var(--fg-ink);
    @supports (color: color-mix(in lab, red, red)) {
      color: color-mix(in oklab, var(--fg-ink) 75%, transparent);
    }
  }
  .text-fg-ink\\/80 {
    color: var(--fg-ink);
    @supports (color: color-mix(in lab, red, red)) {
      color: color-mix(in oklab, var(--fg-ink) 80%, transparent);
    }
  }
  .text-fg-on-accent {
    color: var(--fg-onAccent);
  }
  .text-fg-page {
    color: var(--fg-page);
  }
  .ease-\\(--fg-ease\\) {
    --tw-ease: var(--fg-ease);
    transition-timing-function: var(--fg-ease);
  }
  .placeholder\\:text-fg-grey\\/80::placeholder {
    color: var(--fg-grey);
    @supports (color: color-mix(in lab, red, red)) {
      color: color-mix(in oklab, var(--fg-grey) 80%, transparent);
    }
  }
  .focus-within\\:border-fg-accent:focus-within {
    border-color: var(--fg-accent);
  }
  @media (hover: hover) {
    .hover\\:border-fg-ink:hover {
      border-color: var(--fg-ink);
    }
    .hover\\:bg-fg-accent-deep:hover {
      background-color: var(--fg-accentDeep);
    }
    .hover\\:bg-fg-ink:hover {
      background-color: var(--fg-ink);
    }
    .hover\\:bg-fg-ink\\/\\[0\\.06\\]:hover {
      background-color: var(--fg-ink);
    }
    @supports (color: color-mix(in lab, red, red)) {
      .hover\\:bg-fg-ink\\/\\[0\\.06\\]:hover {
        background-color: color-mix(in oklab, var(--fg-ink) 6%, transparent);
      }
    }
    .hover\\:text-fg-ink:hover {
      color: var(--fg-ink);
    }
    .hover\\:text-fg-page:hover {
      color: var(--fg-page);
    }
  }
  .aria-expanded\\:text-fg-ink[aria-expanded="true"] {
    color: var(--fg-ink);
  }
  @media (width >= 64rem) {
    .lg\\:max-w-\\[calc\\(\\(100svh-var\\(--fg-nav-space\\)-262px\\)\\*1\\.5\\+38px\\)\\] {
      max-width: calc((100svh - var(--fg-nav-space) - 262px) * 1.5 + 38px);
    }
    .lg\\:pt-\\[calc\\(var\\(--fg-nav-space\\)\\+12px\\)\\] {
      padding-top: calc(var(--fg-nav-space) + 12px);
    }
  }
  @media (width >= 96rem) {
    .\\32 xl\\:max-w-\\[calc\\(\\(100svh-var\\(--fg-nav-space\\)-232px\\)\\*1\\.5\\+38px\\)\\] {
      max-width: calc((100svh - var(--fg-nav-space) - 232px) * 1.5 + 38px);
    }
  }
}

/* ---------- Shared alignment ---------- */

.fg-root {
  --fg-ease: cubic-bezier(0.22, 1, 0.36, 1);

  /* Measured from the sticky bar by the navbar; this is only the first-paint guess */
  --fg-nav-space: 76px;

  overflow-x: clip;
  font-stretch: 102%;
}

/* Inner padding: where the logo, the headline and the footer row all start */
.fg-inset {
  padding-inline: 20px;
}

@media (min-width: 640px) {
  .fg-inset {
    padding-inline: 32px;
  }
}

@media (min-width: 1024px) {
  .fg-inset {
    padding-inline: 56px;
  }
}

.fg-container {
  width: 100%;
  max-width: 1600px;
  margin-inline: auto;
}

.fg-root ::selection {
  background: var(--fg-accent);
  color: var(--fg-onAccent);
}

.fg-focus:focus-visible {
  outline: 2px solid var(--fg-accent);
  outline-offset: 3px;
}

/* ---------- Navigation ---------- */

.fg-nav {
  border-bottom: 1px solid transparent;
  transition:
    background-color 0.35s var(--fg-ease),
    border-color 0.35s var(--fg-ease);
}

/* backdrop-filter does not transition, so the colour and border fade while the blur simply switches */
.fg-nav[data-scrolled='true'] {
  background-color: rgba(20, 20, 20, 0.74);
  border-color: rgba(255, 255, 255, 0.08);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  backdrop-filter: blur(14px) saturate(140%);
}

.fg-logo {
  font-weight: 800;
  font-stretch: 118%;
  letter-spacing: -0.045em;
}

/* Grows from the left on the way in and leaves to the right on the way out */
.fg-underline {
  position: relative;
}

.fg-underline::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 2px;
  height: 1px;
  background: currentColor;
  transform: scaleX(0);
  transform-origin: right;
  transition: transform 0.35s var(--fg-ease);
}

.fg-underline:hover::after,
.fg-underline[aria-expanded='true']::after {
  transform: scaleX(1);
  transform-origin: left;
}

/* ---------- Hero ---------- */

/* The hero slides up under the transparent bar, so the scene reaches the very top of the screen */
.fg-hero {
  margin-top: calc(-1 * var(--fg-nav-space));
}

.fg-display {
  font-size: clamp(3.1rem, 0.9rem + 9.4vw, 4.6rem);
  font-weight: 720;
  font-stretch: 104%;
  line-height: 0.95;
  letter-spacing: -0.048em;
  white-space: nowrap;
}

@media (min-width: 1024px) {
  .fg-display {
    font-size: clamp(56px, min(5.7vw, 9.4svh), 96px);
  }
}

/* The mask is padded so descenders and the line's own rise are not clipped */
.fg-mask {
  overflow: hidden;
  padding-bottom: 0.08em;
  margin-bottom: -0.08em;
}

/* Primary button: a highlight sweeps across the surface on hover */
.fg-sheen::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, transparent 30%, rgba(255, 255, 255, 0.38) 50%, transparent 70%);
  transform: translateX(-120%);
  pointer-events: none;
}

.fg-sheen:hover::after {
  transform: translateX(120%);
  transition: transform 0.7s var(--fg-ease);
}

/* Headline letters: a hover drives the letter down like a nail and it springs back slowly */
.fg-letter {
  display: inline-block;
  transition:
    translate 0.7s cubic-bezier(0.34, 1.56, 0.64, 1),
    scale 0.7s cubic-bezier(0.34, 1.56, 0.64, 1),
    color 0.9s var(--fg-ease);
  transform-origin: 50% 100%;
}

@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
  .fg-letter:hover {
    translate: 0 0.07em;
    scale: 1.04 0.9;
    color: var(--fg-accent);
    transition:
      translate 0.07s ease-in,
      scale 0.07s ease-in,
      color 0.07s;
  }
}

/* ---------- Splash ---------- */

/**
 * Where the pre-paint script skipped the splash, it never shows, and the bench photo (the largest paint)
 * is drawn in the first frame instead of waiting for the app to load and reveal it
 */
.fg-root[data-nosplash] .fg-splash {
  display: none;
}

.fg-root[data-nosplash] .fg-bench-reveal,
.fg-root[data-nosplash] .fg-bench-photo {
  opacity: 1 !important;
  filter: none !important;
  transform: none !important;
}

/* The nav logo waits hidden while the splash wordmark flies in to take its place */
.fg-root[data-splash='on'] .fg-logo:not(.fg-splash-word) {
  opacity: 0;
}

/* If the app never hydrates, the splash still lifts itself so the page is never left covered */
.fg-splash {
  animation: fg-splash-failsafe 0.4s ease 7s forwards;
}

@keyframes fg-splash-failsafe {
  to {
    opacity: 0;
    visibility: hidden;
  }
}

.fg-splash-word {
  font-size: clamp(40px, 8.5vw, 130px);
  white-space: nowrap;
}

.fg-splash-heat {
  background: radial-gradient(circle, rgba(255, 129, 77, 0.16) 0%, rgba(255, 129, 77, 0.05) 38%, transparent 68%);
}

.fg-splash-flash {
  background: radial-gradient(
    ellipse at center,
    rgba(255, 214, 160, 0.95) 0%,
    rgba(255, 129, 77, 0.55) 35%,
    transparent 70%
  );
  filter: blur(2px);
}

.fg-spark {
  background: #ffd9a0;
  box-shadow:
    0 0 6px 1px rgba(255, 170, 90, 0.9),
    0 0 14px 2px rgba(255, 129, 77, 0.45);
}

/* The full stop is the brand's ember: it holds a faint glow and flares when the logo is pointed at */
.fg-ember {
  text-shadow: 0 0 10px rgba(255, 129, 77, 0.45);
}

.fg-logo:hover .fg-ember {
  animation: fg-ember 0.9s var(--fg-ease);
}

@keyframes fg-ember {
  30% {
    text-shadow:
      0 0 14px rgba(255, 214, 160, 1),
      0 0 30px rgba(255, 129, 77, 0.9);
    color: #ffd6a3;
  }
}

/* ---------- Background light ---------- */

/* What shows if WebGL2 is unavailable: the same window beam, drawn once and still */
.fg-light-fallback {
  background: linear-gradient(
    148deg,
    transparent 8%,
    rgba(255, 189, 133, 0.07) 22%,
    rgba(255, 189, 133, 0.035) 40%,
    transparent 58%
  );
}

.fg-light-canvas {
  opacity: 0;
  transition: opacity 1.2s var(--fg-ease);
}

.fg-light-canvas[data-ready='true'] {
  opacity: 1;
}

/* ---------- Kit board ---------- */

/* The board sits in a frame like a cutting mat, with rulers along two edges */
.fg-mat {
  background: var(--fg-card);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 40px 80px -40px rgba(0, 0, 0, 0.9);
}

.fg-ruler-x,
.fg-ruler-y {
  font-family: var(--font-fg-mono);
  font-size: 9px;
  color: rgba(245, 243, 239, 0.45);
}

.fg-ruler-x {
  background: repeating-linear-gradient(90deg, rgba(245, 243, 239, 0.28) 0 1px, transparent 1px 1%) bottom / 100% 5px
    no-repeat;
}

.fg-ruler-x span {
  top: 0;
}

.fg-ruler-y {
  background: repeating-linear-gradient(180deg, rgba(245, 243, 239, 0.28) 0 1px, transparent 1px 1.5%) right / 5px 100%
    no-repeat;
}

.fg-ruler-y span {
  left: 0;
}

.fg-board {
  background: #2a2119;
}

/* A warm desk lamp that follows the pointer; it lifts the light without washing out the photo */
.fg-lamp {
  z-index: 10;
  background: radial-gradient(
    circle at calc(var(--lx) * 1%) calc(var(--ly) * 1%),
    rgba(255, 226, 190, 0.22) 0%,
    rgba(255, 226, 190, 0.08) 22%,
    transparent 48%
  );
  mix-blend-mode: soft-light;
}

.fg-tool {
  z-index: 11;
}

.fg-tool:focus-visible {
  outline-offset: 4px;
}

/**
 * A lifted tool casts its shadow away from the lamp: the offset is the tool's centre minus the lamp's
 * position, both in percent of the board, scaled to pixels by --fg-reach
 */
.fg-lifted {
  filter: drop-shadow(
      calc((var(--tx) - var(--lx)) * var(--fg-reach)) calc((var(--ty) - var(--ly)) * var(--fg-reach) + 6px) 10px
        rgba(0, 0, 0, 0.78)
    )
    brightness(1.14) saturate(1.06);
}

/* A tool outside the kit, shown while hovered, at the board's own light */
.fg-preview {
  filter: brightness(0.92) saturate(0.9);
}

/* On the fully lit bench a hovered tool keeps the photo's own light, so it does not darken under the pointer */
.fg-board[data-bright] .fg-preview {
  filter: none;
}

.fg-tag {
  background: rgba(20, 19, 18, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.12);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  box-shadow: 0 10px 24px -10px rgba(0, 0, 0, 0.7);
}

.fg-sweep {
  background: linear-gradient(90deg, transparent, rgba(255, 236, 214, 0.16) 50%, transparent);
  mix-blend-mode: screen;
}

.fg-picker {
  background: var(--fg-card);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.fg-dock {
  background: var(--fg-card);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

/* ---------- Navigation panels ---------- */

.fg-panel {
  background: rgba(24, 23, 22, 0.94);
  border: 1px solid var(--fg-line);
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
  box-shadow: 0 18px 40px -18px rgba(0, 0, 0, 0.7);
}

/* The native clear button clashes with the bar; Escape clears the field instead */
.fg-search::-webkit-search-cancel-button {
  -webkit-appearance: none;
  appearance: none;
}

@media (prefers-reduced-motion: reduce) {
  .fg-sheen::after {
    display: none;
  }

  .fg-underline::after {
    transition: none;
  }
}

/* On a phone an open search needs the room, so the logo steps aside until it closes */
@media (max-width: 639.98px) {
  .fg-nav:has(.fg-search-form[data-open]) .fg-logo {
    display: none;
  }
}
`

const Forge = ({
  brand = { name: '', href: '#' },
  nav = { links: [], search: { action: '#', placeholder: '' }, account: { label: '', href: '#' }, cart: { label: '', href: '#' }, frostAfter: 12 },
  copy = { eyebrow: '', subtext: '', primary: { label: '', href: '#' }, secondary: { label: '', href: '#' }, picker: '', hint: '', trust: [] },
  categories = {},
  categoryOrder = [],
  tools = {},
  projects = [],
  defaultProject,
  boardImage,
  theme,
  splash,
  intro,
  boardOptions,
  shader,
  reducedMotion,
  className
}: ForgeProps) => {
  const resolvedSplash: ForgeSplash = { ...DEFAULT_SPLASH, ...splash }
  const resolvedTheme: ForgeTheme = { ...DEFAULT_THEME, ...theme }

  const value: ForgeContextValue = {
    BRAND: brand,
    NAV: nav,
    COPY: copy,
    CATEGORIES: Object.fromEntries(Object.entries(categories).map(([id, category]) => [id, { ...category, icon: resolveIcon(category.icon) }])),
    CATEGORY_ORDER: categoryOrder,
    TOOLS: tools,
    TOOL_IDS: Object.keys(tools),
    toolImage: (id: ToolId) => tools[id]?.image ?? '',
    PROJECTS: projects.map(project => ({ ...project, icon: resolveIcon(project.icon) })),
    DEFAULT_PROJECT: defaultProject ?? projects[0]?.id ?? 'all',
    ASSETS: { board: boardImage },
    BOARD: { ...DEFAULT_BOARD, ...boardOptions, lampRest: { ...DEFAULT_BOARD.lampRest, ...boardOptions?.lampRest } },
    INTRO: { ...DEFAULT_INTRO, ...intro },
    SPLASH: resolvedSplash,
    SHADER: { ...DEFAULT_SHADER, ...shader },
    REDUCED: reducedMotion
  }

  const themeCss = `.fg-root{${Object.entries(resolvedTheme)
    .map(([role, color]) => `--fg-${role}:${color};`)
    .join('')}}`

  /**
   * Runs before the first paint where scripts execute: small screens and reduced-motion visitors skip the splash, so they see
   * the hero straight away instead of a dark screen waiting for the app's JavaScript
   */
  const noSplashScript = `
  try{var r=document.currentScript.parentElement;if(matchMedia('(max-width: ${resolvedSplash.skipBelow - 0.02}px), (prefers-reduced-motion: reduce)').matches)r.setAttribute('data-nosplash','')}catch(e){}`

  return (
    <ForgeContext.Provider value={value}>
      <style>{BLOCK_CSS}</style>
      <style>{themeCss}</style>
      <MotionProvider>
        {/* The pre-paint script may mark the root before React hydrates, which is expected */}
        <div
          data-slot='forge'
          suppressHydrationWarning
          className={cn('fg-root bg-fg-page font-fg-sans text-fg-ink min-h-dvh w-full antialiased', className)}
        >
          <script dangerouslySetInnerHTML={{ __html: noSplashScript }} />
          <OpeningProvider>
            <Navbar />
            <main>{projects.length > 0 && <HeroSection />}</main>
            {/* At the root, so it covers the sticky nav as well as the hero */}
            {resolvedSplash.enabled && <ForgeSplash />}
          </OpeningProvider>
        </div>
      </MotionProvider>
    </ForgeContext.Provider>
  )
}

export { Forge }
export default Forge