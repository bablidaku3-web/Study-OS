module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#090d0b",
        panel: "#111714",
        line: "#222c27",
        mint: "#b9f36b"
      },
      fontFamily: {
        sans: ["Arial", "Helvetica Neue", "sans-serif"]
      },
      boxShadow: {
        glow: "0 0 36px rgba(185, 243, 107, 0.12)"
      }
    }
  },
  plugins: []
};
