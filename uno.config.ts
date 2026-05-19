
import { defineConfig, presetWind4, transformerDirectives } from 'unocss'

export default defineConfig({
  presets: [presetWind4()],
  transformers: [transformerDirectives()],
  content: {
    filesystem: [
      './app/**/*.{ts,tsx,html}',
    ],
  },
  cli: {
    entry: [
      {
        patterns: ['./app/**/*.{ts,tsx,html}'],
        outFile: '',
      },
    ],
  }
})