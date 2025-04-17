/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}", // Scan all necessary file types in src
    ],
    theme: {
      extend: {},
    },
    plugins: [
      require('@tailwindcss/forms'), // Optional: enhances form styling
    ],
  }