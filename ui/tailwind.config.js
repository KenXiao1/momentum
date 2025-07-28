/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f0ff',
          100: '#e5e5ff',
          500: '#5751D5',
          600: '#4c46c4',
          700: '#413bb3',
          800: '#36309f',
          900: '#2b258b',
        },
        dark: {
          50: '#f8f8f8',
          100: '#f0f0f0',
          500: '#161615',
          600: '#141413',
          700: '#121211',
          800: '#0f0f0e',
          900: '#0d0d0c',
        },
        background: '#FDFDFD',
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans SC', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Noto Sans SC', 'monospace'],
        chinese: ['Noto Sans SC', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.8s ease-out forwards',
        'scale-in': 'scaleIn 0.5s ease-out forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};