// Age bands come from the UCI dataset as half-open intervals, e.g. "[70-80)" = 70 ≤ age < 80.
export const AGE_BAND_NOTE =
  'Ages are recorded in 10-year bands. “[” means that age is included and “)” means it is not, so [70-80) covers ages 70 to 79 and an 80-year-old is in [80-90).'

export function describeAgeBand(band: string): string {
  const m = band.match(/^\[(\d+)-(\d+)\)$/)
  if (!m) return AGE_BAND_NOTE
  const [lo, hi] = [Number(m[1]), Number(m[2])]
  return `Ages ${lo} to ${hi - 1}. “[” means ${lo} is included; “)” means ${hi} is not, so a ${hi}-year-old falls in the next band.`
}
