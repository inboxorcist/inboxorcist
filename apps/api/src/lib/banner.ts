import chalk from 'chalk'
import boxen from 'boxen'

// Tailwind violet palette
const violet = {
  50: '#f5f3ff',
  100: '#ede9fe',
  200: '#ddd6fe',
  300: '#c4b5fd',
  400: '#a78bfa',
  500: '#8b5cf6',
  600: '#7c3aed',
  700: '#6d28d9',
  800: '#5b21b6',
  900: '#4c1d95',
}

interface StartupOptions {
  port: number
  isFirstRun?: boolean
  dbType: string
  queueType: string
}

export function printBanner() {
  console.clear()
  console.log()

  // ASCII art logo with gradient effect
  const logo = [
    '██╗███╗   ██╗██████╗  ██████╗ ██╗  ██╗ ██████╗ ██████╗  ██████╗██╗███████╗████████╗',
    '██║████╗  ██║██╔══██╗██╔═══██╗╚██╗██╔╝██╔═══██╗██╔══██╗██╔════╝██║██╔════╝╚══██╔══╝',
    '██║██╔██╗ ██║██████╔╝██║   ██║ ╚███╔╝ ██║   ██║██████╔╝██║     ██║███████╗   ██║   ',
    '██║██║╚██╗██║██╔══██╗██║   ██║ ██╔██╗ ██║   ██║██╔══██╗██║     ██║╚════██║   ██║   ',
    '██║██║ ╚████║██████╔╝╚██████╔╝██╔╝ ██╗╚██████╔╝██║  ██║╚██████╗██║███████║   ██║   ',
    '╚═╝╚═╝  ╚═══╝╚═════╝  ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝╚═╝╚══════╝   ╚═╝   ',
  ]

  // Gradient colors from violet-400 to violet-600
  const gradientColors = [
    violet[400],
    violet[400],
    violet[500],
    violet[500],
    violet[600],
    violet[600],
  ]

  logo.forEach((line, i) => {
    console.log(chalk.hex(gradientColors[i])('  ' + line))
  })

  console.log()
  console.log(
    chalk.hex(violet[300])('  ✦ ') +
      chalk.hex(violet[200]).italic('The power of delete compels you') +
      chalk.hex(violet[300])(' ✦')
  )
  console.log()
}

export function printStartupInfo(options: StartupOptions) {
  const { port, isFirstRun, dbType, queueType } = options

  // Status box
  const statusBox = boxen(chalk.green.bold('✓') + chalk.white.bold(' Server is running'), {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    margin: { top: 0, bottom: 0, left: 1, right: 0 },
    borderStyle: 'round',
    borderColor: '#a78bfa',
  })
  console.log(statusBox)
  console.log()

  // URL section
  console.log(chalk.hex(violet[300]).bold('  🌐 Open in browser'))
  console.log(chalk.hex(violet[400])(`     http://localhost:${port}`))
  console.log()

  // First run notice
  if (isFirstRun) {
    const firstRunContent = [
      chalk.white('Configure Google OAuth to get started:'),
      chalk.hex(violet[400])(`→ http://localhost:${port}/setup`),
    ].join('\n')

    const firstRunBox = boxen(firstRunContent, {
      title: chalk.hex(violet[300])('⚡ First run detected'),
      titleAlignment: 'left',
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      margin: { top: 0, bottom: 0, left: 1, right: 0 },
      borderStyle: 'round',
      borderColor: '#a78bfa',
    })
    console.log(firstRunBox)
    console.log()
  }

  // Info footer
  console.log(
    chalk.dim(
      `  📦 Database: ${chalk.hex(violet[300])(dbType)}  │  🔄 Queue: ${chalk.hex(violet[300])(queueType)}`
    )
  )
  console.log()
  console.log(chalk.dim('  Press ') + chalk.hex(violet[400])('Ctrl+C') + chalk.dim(' to stop'))
  console.log()
}

export function printError(message: string) {
  console.log(chalk.red.bold('  ✗ Error: ') + chalk.red(message))
}

export function printWarning(message: string) {
  console.log(chalk.hex('#fbbf24')('  ⚠ ') + chalk.hex('#fbbf24')(message))
}

export function printSuccess(message: string) {
  console.log(chalk.hex(violet[400])('  ✓ ') + message)
}
