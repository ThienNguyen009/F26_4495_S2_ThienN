import { createTheme, Input, type MantineColorsTuple } from '@mantine/core'

// Brand green: primary buttons, links, selection, focus. Shade 7 is the main accent.
const brand: MantineColorsTuple = [
  '#eef8f2', '#dcefe3', '#b4dcc3', '#86c59f', '#5cb07f',
  '#3c9f69', '#228d55', '#177a48', '#0f663c', '#08502f',
]

// Neutral greys for secondary text.
const ink: MantineColorsTuple = [
  '#f5f5f5', '#e5e5e5', '#cccccc', '#b3b3b3', '#999999',
  '#808080', '#4d4d4d', '#262626', '#111111', '#000000',
]

// Lighter greys app-wide. 0–4 are surfaces, borders and dividers, kept soft;
// 5–9 are icons and text, lightened a step but still readable on white
// (6 is 3.3:1, used only for small captions; 7 and darker clear 4.5:1).
const gray: MantineColorsTuple = [
  '#fafbfb', '#f4f6f7', '#eef0f2', '#e6e9ec', '#d7dce0',
  '#b4bbc2', '#868e96', '#5c636b', '#3e444b', '#262b30',
]

export const theme = createTheme({
  black: '#262b30',
  white: '#ffffff',
  colors: { brand, ink, gray },
  primaryColor: 'brand',
  primaryShade: 7,
  // matches the 8px cards used across the console
  defaultRadius: 'md',
  fontFamily: "'Manrope', system-ui, 'Segoe UI', Roboto, sans-serif",
  headings: { fontFamily: "'Manrope', system-ui, 'Segoe UI', Roboto, sans-serif", fontWeight: '800' },
  focusRing: 'auto',
  components: {
    Input: Input.extend({
      styles: { input: { borderColor: 'var(--mantine-color-gray-4)' } },
    }),
  },
})
