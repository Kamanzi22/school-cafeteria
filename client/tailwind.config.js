export default {
  content: ['./index.html','./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { body: ['"DM Sans"','system-ui','sans-serif'] },
      colors: {
        brand: { 50:'#fff5ed',100:'#ffead5',200:'#ffd2aa',300:'#ffb07b',400:'#ff8347',500:'#ff5c1a',600:'#f04010',700:'#c72e0e',800:'#9e2613',900:'#7f2014' },
        flame: { 50:'#fff5ed',100:'#ffead5',200:'#ffd2aa',300:'#ffb07b',400:'#ff8347',500:'#ff5c1a',600:'#f04010',700:'#c72e0e',800:'#9e2613',900:'#7f2014' },
        ink: { 50:'#f7f7f8',100:'#eeeef0',200:'#d9d9de',300:'#b8b8c0',400:'#90909c',500:'#6e6e7a',600:'#5a5a65',700:'#4a4a53',800:'#3e3e45',900:'#1a1a20',950:'#0d0d10' },
        alu: {
          bg: '#121212', surface: '#1E1E1E', card: '#252525',
          red: '#E0432B', 'red-hover': '#C73826',
          gold: '#D4A04C', cream: '#F5F1E8', muted: '#9A9A95',
          border: '#2C2C2C', success: '#3E7C59', 'success-fg': '#5aad7e',
        },
      },
      animation: {
        'fade-up':'fadeUp 0.35s cubic-bezier(0.16,1,0.3,1)',
        'scale-in':'scaleIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        'slide-right':'slideRight 0.35s cubic-bezier(0.16,1,0.3,1)',
        'shimmer':'shimmer 1.8s linear infinite',
      },
      keyframes: {
        fadeUp:{ from:{ opacity:0, transform:'translateY(12px)' }, to:{ opacity:1, transform:'translateY(0)' } },
        scaleIn:{ from:{ transform:'scale(0.9)', opacity:0 }, to:{ transform:'scale(1)', opacity:1 } },
        slideRight:{ from:{ transform:'translateX(100%)' }, to:{ transform:'translateX(0)' } },
        shimmer:{ from:{ backgroundPosition:'-200% 0' }, to:{ backgroundPosition:'200% 0' } },
      }
    }
  },
  plugins: []
}
