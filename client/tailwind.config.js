/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["ui-serif", "Georgia", "Cambria", "Times New Roman", "Times", "serif"],
      },
      colors: {
        ink: "#111827", // darker gray/near black
        moss: "#0f5132", // deeper green
        coral: "#d97706", // warm accent (like the image)
        gold: "#b45309",
        skyline: "#1e3a8a",
        cream: "#fdfcf9",
      },
      boxShadow: {
        soft: "0 4px 20px rgba(0, 0, 0, 0.05)",
        medium: "0 10px 40px rgba(0, 0, 0, 0.08)",
      },
    },
  },
  plugins: [],
};

