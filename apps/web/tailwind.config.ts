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
        sidebar:       'hsl(var(--sidebar))',
        topbar:        'hsl(var(--topbar))',
        // Studio semantic
        studio: {
          'primary-light': '#EFF6FF',
          'success':       '#059669',
          'success-bg':    '#ECFDF5',
          'success-border':'#A7F3D0',
          'warning':       '#D97706',
          'warning-bg':    '#FFFBEB',
          'warning-border':'#FDE68A',
          'danger':        '#DC2626',
          'danger-bg':     '#FEF2F2',
          'danger-border': '#FECACA',
          'info-bg':       '#EFF6FF',
          'info-border':   '#BFDBFE',
        },
        // Risk
        risk: {
          critical:        { DEFAULT: '#DC2626', bg: '#FEF2F2', border: '#FECACA', text: '#991B1B' },
          high:            { DEFAULT: '#D97706', bg: '#FEF3C7', border: '#FDE68A', text: '#92400E' },
          medium:          { DEFAULT: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8' },
          low:             { DEFAULT: '#059669', bg: '#F0FDF4', border: '#BBF7D0', text: '#166534' },
        },
        // Graph node colors
        'node-folder': '#6366f1',
        'node-file':   '#2563EB',
        'node-service':'#8b5cf6',
        'node-route':  '#059669',
        'node-module': '#D97706',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 1px)',
        sm: '4px',
        xs: '3px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px', letterSpacing: '0.06em' }],
        'page': ['18px', { lineHeight: '28px', fontWeight: '500' }],
        'section': ['13px', { lineHeight: '20px', fontWeight: '500' }],
        'body': ['13px', { lineHeight: '20px' }],
        'kpi': ['22px', { lineHeight: '32px', fontWeight: '500' }],
      },
      spacing: {
        'sidebar': '200px',
        'topbar':  '44px',
      },
      keyframes: {
        'accordion-down':  { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up':    { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        'fade-in':         { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-in':        { from: { opacity: '0', transform: 'translateX(-8px)' }, to: { opacity: '1', transform: 'none' } },
        'shimmer':         { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
        'fade-in':        'fade-in 0.2s ease-out',
        'slide-in':       'slide-in 0.2s ease-out',
        'shimmer':        'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
