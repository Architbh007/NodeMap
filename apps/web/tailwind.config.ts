import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        background:    'hsl(var(--background))',
        foreground:    'hsl(var(--foreground))',
        card:          { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover:       { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        primary:       { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary:     { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted:         { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent:        { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive:   { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        border:        'hsl(var(--border))',
        input:         'hsl(var(--input))',
        ring:          'hsl(var(--ring))',
        surface:       'hsl(var(--surface))',
        // Graph node colors — distinct from brand
        'node-folder': '#6366f1',
        'node-file':   '#06b6d4',
        'node-service':'#8b5cf6',
        'node-route':  '#10b981',
        'node-module': '#f59e0b',
        risk: {
          low:      '#22c55e',
          medium:   '#f59e0b',
          high:     '#f97316',
          critical: '#ef4444',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 1px)',
        sm: 'calc(var(--radius) / 2)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      keyframes: {
        'accordion-down':  { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up':    { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        'fade-in':         { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        'pulse-glow':      { '0%,100%': { boxShadow: '0 0 8px hsl(158 64% 48% / 0.25)' }, '50%': { boxShadow: '0 0 28px hsl(158 64% 48% / 0.45)' } },
        'shimmer':         { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
        'cursor-blink':    { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0' } },
        'draw-line':       { from: { strokeDashoffset: '1000' }, to: { strokeDashoffset: '0' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
        'fade-in':        'fade-in 0.25s ease-out',
        'pulse-glow':     'pulse-glow 2s ease-in-out infinite',
        'shimmer':        'shimmer 2s linear infinite',
        'cursor-blink':   'cursor-blink 1.1s step-end infinite',
      },
      backgroundImage: {
        'grid-pattern': `linear-gradient(hsl(158 64% 48% / 0.04) 1px, transparent 1px),
                         linear-gradient(90deg, hsl(158 64% 48% / 0.04) 1px, transparent 1px)`,
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-glow':     'radial-gradient(ellipse 80% 50% at 50% -20%,hsl(158 64% 48% / 0.12),transparent)',
      },
      backgroundSize: {
        'grid': '32px 32px',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
