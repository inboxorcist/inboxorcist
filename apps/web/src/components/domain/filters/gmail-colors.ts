/**
 * Gmail's 75 preset label colors
 * These are the only colors allowed by the Gmail API
 */

export interface GmailLabelColor {
  backgroundColor: string
  textColor: string
}

// Gmail's official preset colors (75 combinations)
export const GMAIL_LABEL_COLORS: GmailLabelColor[] = [
  // Row 1 - Berries/Reds
  { backgroundColor: '#000000', textColor: '#ffffff' },
  { backgroundColor: '#434343', textColor: '#ffffff' },
  { backgroundColor: '#666666', textColor: '#ffffff' },
  { backgroundColor: '#999999', textColor: '#ffffff' },
  { backgroundColor: '#cccccc', textColor: '#000000' },
  { backgroundColor: '#efefef', textColor: '#000000' },
  { backgroundColor: '#f3f3f3', textColor: '#000000' },

  // Row 2 - Reds
  { backgroundColor: '#fb4c2f', textColor: '#ffffff' },
  { backgroundColor: '#ffad47', textColor: '#000000' },
  { backgroundColor: '#fad165', textColor: '#000000' },
  { backgroundColor: '#16a765', textColor: '#ffffff' },
  { backgroundColor: '#43d692', textColor: '#000000' },
  { backgroundColor: '#4a86e8', textColor: '#ffffff' },
  { backgroundColor: '#a479e2', textColor: '#ffffff' },

  // Row 3 - More variations
  { backgroundColor: '#f691b3', textColor: '#000000' },
  { backgroundColor: '#f6c5be', textColor: '#000000' },
  { backgroundColor: '#ffe6c7', textColor: '#000000' },
  { backgroundColor: '#fef1d1', textColor: '#000000' },
  { backgroundColor: '#b9e4d0', textColor: '#000000' },
  { backgroundColor: '#c6f3de', textColor: '#000000' },
  { backgroundColor: '#c9daf8', textColor: '#000000' },

  // Row 4
  { backgroundColor: '#e4d7f5', textColor: '#000000' },
  { backgroundColor: '#fcdee8', textColor: '#000000' },
  { backgroundColor: '#efa093', textColor: '#000000' },
  { backgroundColor: '#ffc8af', textColor: '#000000' },
  { backgroundColor: '#ffdeb5', textColor: '#000000' },
  { backgroundColor: '#fbe983', textColor: '#000000' },
  { backgroundColor: '#b3efd3', textColor: '#000000' },

  // Row 5
  { backgroundColor: '#a0eac9', textColor: '#000000' },
  { backgroundColor: '#a4c2f4', textColor: '#000000' },
  { backgroundColor: '#d0bcf1', textColor: '#000000' },
  { backgroundColor: '#fbc8d9', textColor: '#000000' },
  { backgroundColor: '#e66550', textColor: '#ffffff' },
  { backgroundColor: '#ffbc6b', textColor: '#000000' },
  { backgroundColor: '#fcda83', textColor: '#000000' },

  // Row 6
  { backgroundColor: '#44b984', textColor: '#ffffff' },
  { backgroundColor: '#68dfa9', textColor: '#000000' },
  { backgroundColor: '#6d9eeb', textColor: '#ffffff' },
  { backgroundColor: '#b694e8', textColor: '#ffffff' },
  { backgroundColor: '#f7a7c0', textColor: '#000000' },
  { backgroundColor: '#cc3a21', textColor: '#ffffff' },
  { backgroundColor: '#eaa041', textColor: '#000000' },

  // Row 7
  { backgroundColor: '#f2c960', textColor: '#000000' },
  { backgroundColor: '#149e60', textColor: '#ffffff' },
  { backgroundColor: '#3dc789', textColor: '#000000' },
  { backgroundColor: '#3c78d8', textColor: '#ffffff' },
  { backgroundColor: '#8e63ce', textColor: '#ffffff' },
  { backgroundColor: '#e07798', textColor: '#ffffff' },
  { backgroundColor: '#ac2b16', textColor: '#ffffff' },

  // Row 8
  { backgroundColor: '#cf8933', textColor: '#ffffff' },
  { backgroundColor: '#d5ae49', textColor: '#000000' },
  { backgroundColor: '#0b804b', textColor: '#ffffff' },
  { backgroundColor: '#2a9c68', textColor: '#ffffff' },
  { backgroundColor: '#285bac', textColor: '#ffffff' },
  { backgroundColor: '#653e9b', textColor: '#ffffff' },
  { backgroundColor: '#b65775', textColor: '#ffffff' },

  // Row 9
  { backgroundColor: '#822111', textColor: '#ffffff' },
  { backgroundColor: '#a46a21', textColor: '#ffffff' },
  { backgroundColor: '#aa8831', textColor: '#ffffff' },
  { backgroundColor: '#076239', textColor: '#ffffff' },
  { backgroundColor: '#1a764d', textColor: '#ffffff' },
  { backgroundColor: '#1c4587', textColor: '#ffffff' },
  { backgroundColor: '#41236d', textColor: '#ffffff' },

  // Row 10
  { backgroundColor: '#83334c', textColor: '#ffffff' },
  { backgroundColor: '#464646', textColor: '#ffffff' },
  { backgroundColor: '#e7e7e7', textColor: '#000000' },
  { backgroundColor: '#0d3472', textColor: '#ffffff' },
  { backgroundColor: '#b6cff5', textColor: '#000000' },
  { backgroundColor: '#98d7e4', textColor: '#000000' },
  { backgroundColor: '#e3d7ff', textColor: '#000000' },

  // Row 11 - Additional colors
  { backgroundColor: '#fbd3e0', textColor: '#000000' },
  { backgroundColor: '#f2b2a8', textColor: '#000000' },
  { backgroundColor: '#c2c2c2', textColor: '#000000' },
]

// Default color for new labels
export const DEFAULT_LABEL_COLOR: GmailLabelColor = {
  backgroundColor: '#4a86e8',
  textColor: '#ffffff',
}

/**
 * Find the closest matching Gmail color
 */
export function findClosestGmailColor(bgColor: string): GmailLabelColor {
  const normalized = bgColor.toLowerCase()
  const match = GMAIL_LABEL_COLORS.find((c) => c.backgroundColor.toLowerCase() === normalized)
  return match || DEFAULT_LABEL_COLOR
}
