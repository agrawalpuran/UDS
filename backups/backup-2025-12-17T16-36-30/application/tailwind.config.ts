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
        // ServiceNow Official Brand Colors
        servicenow: {
          'infinite-blue': '#032D42',
          'wasabi-green': '#62D84E',
          'black': '#000000',
          'white': '#FFFFFF',
        },
        // ServiceNow-inspired neutral palette
        neutral: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#032D42', /* ServiceNow Infinite Blue */
        },
        primary: {
          50: '#f0f5f8',
          100: '#d9e6ed',
          200: '#b3cddb',
          300: '#8db4c9',
          400: '#679bb7',
          500: '#032D42', /* ServiceNow Infinite Blue */
          600: '#022535',
          700: '#021d28',
          800: '#01161b',
          900: '#010f14',
        },
        accent: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#62D84E', /* ServiceNow Wasabi Green */
          500: '#3ecf2e',
          600: '#2ea81f',
          700: '#238017',
          800: '#1d6612',
          900: '#16540f',
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
        success: {
          DEFAULT: '#22c55e',
          bg: '#f0fdf4',
        },
        warning: {
          DEFAULT: '#fbbf24',
          bg: '#fffbeb',
        },
        error: {
          DEFAULT: '#dc2626',
          bg: '#fef2f2',
        },
        info: {
          DEFAULT: '#3b82f6',
          bg: '#eff6ff',
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


