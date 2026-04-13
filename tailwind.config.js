/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        sans:    ['Plus Jakarta Sans', 'sans-serif'],
      },
      colors: {
        green:   'var(--green)',
        green2:  'var(--green2)',
        orange:  'var(--orange)',
        blue:    'var(--blue)',
        amber:   'var(--amber)',
        red:     'var(--red)',
        purple:  'var(--purple)',
        text:    'var(--text)',
        text2:   'var(--text2)',
        text3:   'var(--text3)',
        muted:   'var(--muted)',
        border:  'var(--border)',
        border2: 'var(--border2)',
        bg:      'var(--bg)',
        bg2:     'var(--bg2)',
        surface:   'var(--surface)',
        surface2:  'var(--surface2)',
        surface3:  'var(--surface3)',
      },
      backgroundColor: {
        'green-dim':  'var(--green-dim)',
        'orange-dim': 'var(--orange-dim)',
        'blue-dim':   'var(--blue-dim)',
        'amber-dim':  'var(--amber-dim)',
        'red-dim':    'var(--red-dim)',
        'purple-dim': 'var(--purple-dim)',
      },
      borderRadius: {
        DEFAULT: 'var(--r-sm)',
        lg:      'var(--r-lg)',
        xl:      'var(--r-xl)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      animation: {
        fadeUp: 'fadeUp 0.3s ease both',
        fadeIn: 'fadeIn 0.2s ease both',
      },
    },
  },
  plugins: [],
}
