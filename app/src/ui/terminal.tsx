import {
  ITerminalOptions,
  ITerminalInitOnlyOptions,
  Terminal as XTermTerminal,
} from '@xterm/xterm'
import React from 'react'
import { getMonospaceFontFamily } from './get-monospace-font-family'
import { TerminalOutput } from '../lib/git'

export const defaultTerminalOptions: Readonly<ITerminalOptions> = {
  convertEol: true,
  fontFamily: getMonospaceFontFamily(),
  fontSize: 12,
  screenReaderMode: true,
  disableStdin: true,
}

export type TerminalProps = ITerminalOptions &
  ITerminalInitOnlyOptions & {
    readonly terminalOutput?: TerminalOutput
    readonly hideCursor?: boolean
    /**
     * Whether or not to render the terminal contents in plain
     * text for screen readers.
     *
     * Note that this will also hide the terminal from screen readers
     */
    readonly renderContentsForScreenReader?: boolean
  }

interface ITerminalState {
  readonly screenReaderContent: string
}

export class Terminal extends React.Component<TerminalProps, ITerminalState> {
  private terminalRef = React.createRef<HTMLDivElement>()
  private terminal: XTermTerminal | null = null

  public constructor(props: TerminalProps) {
    super(props)
    this.state = { screenReaderContent: '' }
  }

  public get Terminal() {
    return this.terminal
  }

  public write(data: TerminalOutput) {
    if (Array.isArray(data)) {
      data.forEach(chunk =>
        this.terminal?.write(chunk, this.onTerminalWriteComplete)
      )
    } else {
      this.terminal?.write(data, this.onTerminalWriteComplete)
    }
  }

  private onTerminalWriteComplete = () => {
    if (!this.props.renderContentsForScreenReader || !this.terminal) {
      return
    }

    const buffer = this.terminal.buffer.active
    const lines: Array<string> = []

    for (let i = 0; i < buffer.length; i++) {
      const line = buffer.getLine(i)
      if (line) {
        lines.push(line.translateToString(true))
      }
    }

    this.setState({ screenReaderContent: lines.join('\n') })
  }

  public componentWillUnmount(): void {
    this.terminal?.dispose()
  }

  public componentDidMount() {
    const { terminalOutput, hideCursor, ...initOpts } = this.props
    this.terminal = new XTermTerminal({
      ...defaultTerminalOptions,
      ...initOpts,

      rows: this.props.rows ?? 20,
      cols: this.props.cols ?? 80,
    })

    this.terminal.attachCustomKeyEventHandler((key: KeyboardEvent) => {
      if (key.key === 'Tab') {
        // We don't want to handle tab key events in the terminal as it
        // breaks tab navigation in the app. The terminal is read only and
        // doesn't support tab input, so we can safely ignore it.
        return false
      }
      return true
    })

    if (this.terminalRef.current) {
      this.terminal.open(this.terminalRef.current)

      if (hideCursor !== false) {
        this.terminal.write('\x1b[?25l') // hide cursor
        if (terminalOutput) {
          this.write(terminalOutput)
        }
      }
    }
  }

  public render() {
    return (
      <>
        {this.props.renderContentsForScreenReader &&
          this.state.screenReaderContent && (
            <pre className="sr-only" aria-live="polite" aria-atomic={true}>
              {this.state.screenReaderContent}
            </pre>
          )}
        <div
          aria-hidden={this.props.renderContentsForScreenReader}
          ref={this.terminalRef}
        ></div>
      </>
    )
  }
}
