import { createTheme, Input, type MantineColorsTuple } from '@mantine/core'

// Brand green: primary buttons, links, selection, focus. Shade 7 is the main accent.
const brand: MantineColorsTuple = [
  '#e9f5ee', '#d3eadc', '#a6d4b9', '#76bd94', '#4ea976',
  '#349c63', '#228d55', '#177a48', '#0f663c', '#08502f',
]

// Neutral greys for secondary text.
const ink: MantineColorsTuple = [
  '#f5f5f5', '#e5e5e5', '#cccccc', '#b3b3b3', '#999999',
  '#808080', '#4d4d4d', '#262626', '#111111', '#000000',
]

export const theme = createTheme({
  black: '#111111',
  white: '#ffffff',
  colors: { brand, ink },
  primaryColor: 'brand',
  primaryShade: 7,
  defaultRadius: 0,
  fontFamily: "'Manrope', system-ui, 'Segoe UI', Roboto, sans-serif",
  headings: { fontFamily: "'Manrope', system-ui, 'Segoe UI', Roboto, sans-serif", fontWeight: '800' },
  focusRing: 'auto',
  components: {
    Input: Input.extend({
      styles: { input: { borderColor: 'var(--mantine-color-gray-4)' } },
    }),
  },
})
