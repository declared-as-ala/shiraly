/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F5EDE6',
          100: '#EBE0D6',
          200: '#D9C7B8',
          300: '#BFA58F',
          400: '#A07B5E',
          500: '#8B5E34',
          600: '#6B4423',
          700: '#54381C',
          800: '#3D2B1F',
          900: '#2A1E14',
        },
        sand: {
          50: '#FDFBFA',
          100: '#FBF7F2',
          200: '#F5EDE6',
          300: '#EBE0D6',
          400: '#D9C7B8',
          500: '#C4AD9C',
          600: '#A0887A',
        },
        cta: {
          DEFAULT: '#8B5E34',
          dark: '#6B4423',
          light: '#A07B5E',
        },
        ink: {
          50: '#FDFBF9',
          100: '#F5F0EB',
          200: '#E8DED5',
          500: '#6B5846',
          900: '#3D2B1F',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['"Playfair Display"', 'Georgia', 'serif'],
        arabic: ['Cairo', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 4px 24px -8px rgba(139,94,52,0.15)',
        'card': '0 8px 32px -12px rgba(61,43,31,0.1)',
        'cta': '0 12px 28px -8px rgba(139,94,52,0.4)',
      },
      animation: {
        'shake': 'shake 1.5s ease-in-out infinite',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-3px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(3px)' },
        },
      },
    },
  },
  plugins: [],
};
