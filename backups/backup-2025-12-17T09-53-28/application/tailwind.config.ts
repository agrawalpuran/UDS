import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fff4ed',
          100: '#ffe9d6',
          200: '#ffd3ad',
          300: '#ffb880',
          400: '#ff9647',
          500: '#f76b1c', /* ICICI Bank primary orange */
          600: '#dc5514',
          700: '#b84412',
          800: '#943815',
          900: '#783114',
        },
        accent: {
          50: '#fee2e2',
          100: '#fecaca',
          200: '#fca5a5',
          300: '#f87171',
          400: '#ef4444',
          500: '#dc2626', /* ICICI Bank accent red */
          600: '#b91c1c',
          700: '#991b1b',
          800: '#7f1d1d',
          900: '#7f1d1d',
        },
        icici: {
          orange: '#f76b1c',
          'orange-dark': '#dc5514',
          'orange-light': '#ff9647',
          red: '#dc2626',
          blue: '#003d82',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      boxShadow: {
        'modern': '0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.08)',
        'modern-lg': '0 10px 25px rgba(0, 0, 0, 0.08), 0 4px 10px rgba(0, 0, 0, 0.06)',
        'modern-xl': '0 20px 40px rgba(0, 0, 0, 0.1), 0 8px 16px rgba(0, 0, 0, 0.08)',
        'glow': '0 0 20px rgba(247, 107, 28, 0.3)',
        'glow-orange': '0 0 20px rgba(247, 107, 28, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
export default config


