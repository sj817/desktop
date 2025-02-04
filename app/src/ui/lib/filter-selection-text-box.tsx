import * as React from 'react'
import { ITextBoxProps, TextBox } from './text-box'
import { Button } from './button'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { Popover, PopoverAnchorPosition, PopoverDecoration } from './popover'
import { Checkbox, CheckboxValue } from './checkbox'
import classNames from 'classnames'
import { FocusContainer } from './focus-container'

export type FilterOption = {
  id: string
  label: string
  value: CheckboxValue
}

interface IFilterSelectionTextBoxProps extends ITextBoxProps {
  readonly filterOptions: ReadonlyArray<FilterOption>
  readonly onFilterOptionChanged: (filterOption: FilterOption) => void
}

interface IFilterSelectionTextBoxState {
  readonly isPopoverOpen: boolean
  readonly inputFocused: boolean
}

export class FilterSelectionTextBox extends React.Component<
  IFilterSelectionTextBoxProps,
  IFilterSelectionTextBoxState
> {
  private filterIconRef = React.createRef<HTMLSpanElement>()
  public textBoxRef = React.createRef<TextBox>()

  public constructor(props: IFilterSelectionTextBoxProps) {
    super(props)
    this.state = {
      isPopoverOpen: false,
      inputFocused: false,
    }
  }

  private onToggleFilterSelection = (
    event: React.FormEvent<HTMLButtonElement>
  ) => {
    event.preventDefault()
    if (this.state.isPopoverOpen) {
      this.closePopover()
    } else {
      this.openPopover()
    }
  }

  private openPopover = () => {
    this.setState(prevState => {
      if (!prevState.isPopoverOpen) {
        return { isPopoverOpen: true }
      }
      return null
    })
  }

  private closePopover = () => {
    this.setState(prevState => {
      if (prevState.isPopoverOpen) {
        return { isPopoverOpen: false }
      }

      return null
    })
  }

  private getFilterOptionChangedCallback = (filterOption: FilterOption) => {
    return (event: React.FormEvent<HTMLInputElement>) => {
      this.props.onFilterOptionChanged({
        ...filterOption,
        value: event.currentTarget.checked
          ? CheckboxValue.On
          : CheckboxValue.Off,
      })
    }
  }

  private getFilterOptionButtonCallback = (filterOption: FilterOption) => {
    return () => {
      this.props.onFilterOptionChanged({
        ...filterOption,
        value: CheckboxValue.Off,
      })
    }
  }

  private renderPopover() {
    const filterOptions = this.props.filterOptions.map(option => {
      return (
        <Checkbox
          key={option.id}
          value={option.value}
          label={option.label}
          onChange={this.getFilterOptionChangedCallback(option)}
        />
      )
    })
    return (
      <Popover
        ariaLabelledby="filter-popover-header"
        anchor={this.filterIconRef.current}
        anchorPosition={PopoverAnchorPosition.BottomRight}
        decoration={PopoverDecoration.Balloon}
        onMousedownOutside={this.closePopover}
        onClickOutside={this.closePopover}
      >
        <h3 id="filter-popover-header">Filter Options</h3>
        {filterOptions}
      </Popover>
    )
  }

  private onTextBoxFocused = () => {
    this.setState({ inputFocused: true })
  }

  private onTextBoxBlur = () => {
    this.setState({ inputFocused: false })
  }

  public render() {
    const appliedFilters = this.props.filterOptions
      .filter(o => o.value === CheckboxValue.On)
      .map(option => {
        return (
          <Button
            key={option.id}
            onClick={this.getFilterOptionButtonCallback(option)}
          >
            {option.label}
            <Octicon symbol={octicons.x} />
          </Button>
        )
      })

    const className = classNames('filter-selection-text-box', {
      'input-focused': this.state.inputFocused,
    })

    return (
      <FocusContainer className={className}>
        <div className="input-group">
          <Button
            onClick={this.onToggleFilterSelection}
            ariaLabel="Filter Options"
            ariaExpanded={this.state.isPopoverOpen}
          >
            <span ref={this.filterIconRef}>
              <Octicon className="prefixed-icon" symbol={octicons.search} />
            </span>
            <Octicon className="prefixed-icon" symbol={octicons.triangleDown} />
          </Button>
          <TextBox
            ref={this.textBoxRef}
            {...this.props}
            onFocus={this.onTextBoxFocused}
            onBlur={this.onTextBoxBlur}
          />
          {this.state.isPopoverOpen && this.renderPopover()}
        </div>
        <div className="filter-options-applied">{appliedFilters}</div>
      </FocusContainer>
    )
  }
}
