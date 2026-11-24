import { Tooltip } from '@mantine/core'
import classes from './AgeBand.module.css'
import { AGE_BAND_NOTE, describeAgeBand } from './ageBandText'

// An age band with a hover / focus tooltip explaining the bracket notation.
export function AgeBand({ band }: { band: string }) {
  return (
    <Tooltip label={describeAgeBand(band)} multiline w={260} withArrow openDelay={150} events={{ hover: true, focus: true, touch: true }}>
      <span className={classes.band} tabIndex={0}>
        {band}
      </span>
    </Tooltip>
  )
}

// Column / field label with the general explanation.
export function AgeBandLabel({ children = 'Age band' }: { children?: string }) {
  return (
    <Tooltip label={AGE_BAND_NOTE} multiline w={280} withArrow openDelay={150} events={{ hover: true, focus: true, touch: true }}>
      <span className={classes.band} tabIndex={0}>
        {children}
      </span>
    </Tooltip>
  )
}
