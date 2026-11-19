/** @type {import("prettier").Config} */
module.exports = {
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 80,
  plugins: ['prettier-plugin-tailwindcss'],
  // Tailwind 4 has no JS entry point; the plugin reads the theme from CSS.
  tailwindStylesheet: './src/index.css',
};
