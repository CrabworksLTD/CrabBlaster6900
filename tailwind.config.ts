import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#c0c0c0',
          secondary: '#c0c0c0',
          tertiary: '#d4d0c8'
        },
        border: {
          DEFAULT: '#808080',
          hover: '#404040'
        },
        accent: {
          DEFAULT: '#000080',
          hover: '#0000a8',
          muted: '#00008020'
        },
        win: {
          bg: '#c0c0c0',
          light: '#ffffff',
          mid: '#d4d0c8',
          dark: '#808080',
          darker: '#404040',
          darkest: '#000000',
          blue: '#000080',
          bluelight: '#1084d0',
          teal: '#008080'
        },
        success: '#008000',
        warning: '#808000',
        danger: '#ff0000'
      },
      fontFamily: {
        win: ['"MS Sans Serif"', '"Microsoft Sans Serif"', 'Tahoma', 'Geneva', 'sans-serif'],
        sys: ['"Fixedsys"', '"Courier New"', 'monospace']
      },
      boxShadow: {
        'win-out': 'inset -1px -1px #0a0a0a, inset 1px 1px #ffffff, inset -2px -2px #808080, inset 2px 2px #d4d0c8',
        'win-in': 'inset -1px -1px #ffffff, inset 1px 1px #0a0a0a, inset -2px -2px #d4d0c8, inset 2px 2px #808080',
        'win-btn': 'inset -1px -1px #0a0a0a, inset 1px 1px #ffffff, inset -2px -2px #808080, inset 2px 2px #d4d0c8',
        'win-btn-pressed': 'inset -1px -1px #ffffff, inset 1px 1px #0a0a0a, inset -2px -2px #d4d0c8, inset 2px 2px #808080',
        'win-field': 'inset -1px -1px #d4d0c8, inset 1px 1px #808080, inset -2px -2px #ffffff, inset 2px 2px #0a0a0a',
      }
    }
  },
  plugins: []
}

export default config
