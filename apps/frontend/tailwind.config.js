/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gray: {
          750: '#2D3748',
        },
        brand: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
          950: '#1E1B4B',
        },
        // Brand Tier 2 — "Ink + Ochre" palette. Used only by the brand-v2 CSS
        // layer + components that explicitly opt in; Tier 1 (brand-*) is the
        // default until ink_ochre_palette flips on for all users.
        ink: {
          50: '#F4F6F8',
          100: '#E5E9EF',
          200: '#C7CED9',
          300: '#9CA7B9',
          400: '#6A7891',
          500: '#475569',
          600: '#334155',
          700: '#22304A',
          800: '#16213D',
          900: '#0B1530',
          950: '#050B1F',
        },
        ochre: {
          50: '#FBF6EC',
          100: '#F5E9CC',
          200: '#EBD295',
          300: '#DDB761',
          400: '#CC9C3A',
          500: '#B7841F',
          600: '#956914',
          700: '#724F10',
          800: '#523810',
          900: '#36240C',
          950: '#1F1505',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        // Brand Tier 2 display serif — Fraunces. Used by .brand-v2 headings
        // when the fraunces_display flag is on.
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-out',
        'scale-in': 'scaleIn 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'slide-up': 'slideUp 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'slide-down': 'slideDown 200ms ease-out',
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
        'node-enter': 'nodeEnter 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'smooth-appear': 'smoothAppear 400ms cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        nodeEnter: {
          from: { opacity: '0', transform: 'scale(0.92)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        smoothAppear: {
          from: { opacity: '0', transform: 'scale(0.97) translateY(4px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      boxShadow: {
        node: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'node-hover': '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        'glow-blue': '0 0 12px rgba(59,130,246,0.3)',
        'glow-purple': '0 0 12px rgba(139,92,246,0.3)',
        'card-hover': '0 4px 16px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
};
