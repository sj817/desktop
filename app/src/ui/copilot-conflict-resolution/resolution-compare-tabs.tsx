import * as React from 'react'
import classNames from 'classnames'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'

/** The available tabs in the resolution comparison view. */
export type ResolutionTab = 'conflict' | 'ours' | 'theirs' | 'copilot'

interface IResolutionCompareTabsProps {
  readonly selectedTab: ResolutionTab
  readonly onTabSelected: (tab: ResolutionTab) => void
}

const tabs: ReadonlyArray<{
  readonly id: ResolutionTab
  readonly label: string
  readonly showCopilotIcon: boolean
}> = [
  { id: 'conflict', label: 'Conflict', showCopilotIcon: false },
  { id: 'ours', label: 'Ours', showCopilotIcon: false },
  { id: 'theirs', label: 'Theirs', showCopilotIcon: false },
  { id: 'copilot', label: 'Copilot', showCopilotIcon: true },
]

/**
 * A tab bar for switching between conflict resolution views.
 *
 * Displays tabs for the original conflict, ours, theirs, and Copilot's
 * suggested resolution.
 */
export class ResolutionCompareTabs extends React.Component<IResolutionCompareTabsProps> {
  public render() {
    return (
      <div className="resolution-compare-tabs" role="tablist">
        {tabs.map(tab => this.renderTab(tab))}
      </div>
    )
  }

  private renderTab(tab: {
    readonly id: ResolutionTab
    readonly label: string
    readonly showCopilotIcon: boolean
  }) {
    const isSelected = this.props.selectedTab === tab.id
    const className = classNames('resolution-tab', {
      selected: isSelected,
      'copilot-tab': tab.id === 'copilot',
    })

    return (
      <button
        key={tab.id}
        className={className}
        role="tab"
        aria-selected={isSelected}
        onClick={this.onTabClick(tab.id)}
      >
        {tab.showCopilotIcon && (
          <Octicon symbol={octicons.copilot} className="copilot-tab-icon" />
        )}
        {tab.label}
      </button>
    )
  }

  private onTabClick = (tab: ResolutionTab) => () => {
    this.props.onTabSelected(tab)
  }
}
