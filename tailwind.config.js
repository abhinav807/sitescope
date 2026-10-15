/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0c0e0c',
          900: '#121412',
          850: '#161916',
          800: '#1c201c',
          700: '#262b26',
          600: '#333933',
        },
        lime: {
          accent: '#c8f04a',
        },
        cyan: {
          accent: '#59e3d4',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
