import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        retro: {
          bg: '#FAF7F2',
          card: '#EAE6DB',
          border: '#1F2937',
          green: '#94A884',
          'green-light': '#D9E2D0',
          terracotta: '#E07A5F',
          yellow: '#F4EA8A',
        }
      },
      boxShadow: {
        'retro': '3px 3px 0px 0px #1F2937',
        'retro-lg': '4px 4px 0px 0px #1F2937',
      }
    },
  },
  plugins: [],
};
export default config;