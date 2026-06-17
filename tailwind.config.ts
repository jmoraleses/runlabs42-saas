import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
        display: ['Bricolage Grotesque', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          200: '#c1d3ff',
          300: '#a2bdff',
          400: '#8fa7ff',
          500: '#6b84ff',
          600: '#5568ff',
          700: '#3f4dff',
          800: '#2832ff',
          900: '#1a1cff',
          950: '#0f0f99',
        },
        accent: {
          50: '#fdf3f8',
          100: '#fbe7f1',
          200: '#f7cfe3',
          300: '#f1a8cf',
          400: '#e87eb7',
          500: '#dc549f',
          600: '#c73b7f',
          700: '#a42a66',
          800: '#862254',
          900: '#6d1f48',
          950: '#420e29',
        },
        surface: {
          50: '#f9f9fa',
          100: '#f3f3f5',
          200: '#ececf1',
          300: '#d9d9e3',
          400: '#bdbdc7',
          500: '#a0a0ab',
          600: '#858592',
          700: '#6b6b78',
          800: '#54545f',
          900: '#3d3d47',
          950: '#1a1a1f',
        },
      },
      spacing: {
        xs: '0.5rem',
        sm: '0.75rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '2.5rem',
        '3xl': '3rem',
        '4xl': '4rem',
        '5xl': '6rem',
      },
      borderRadius: {
        xs: '0.25rem',
        sm: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
        full: '9999px',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'pulse-soft': 'pulse-soft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer: 'shimmer 2s infinite',
      },
    },
  },
  plugins: [],
}

export default config
