import * as React from 'react'
import { t } from '@i18n'
import { Trans } from 'react-i18next'
import { DialogContent } from '../dialog'
import { LinkButton } from '../lib/link-button'
import { Row } from '../../ui/lib/row'
import { Select } from '../lib/select'
import { Shell, parse as parseShell } from '../../lib/shells'
import { suggestedExternalEditor } from '../../lib/editors/shared'
import { CustomIntegrationForm } from './custom-integration-form'
import {
  ICustomIntegration,
  TargetPathArgument,
} from '../../lib/custom-integration'
import { enableCustomIntegration } from '../../lib/feature-flag'
import { Button } from '../lib/button'

const CustomIntegrationValue = 'other'

interface IEditorSlot {
  readonly selectedEditor: string | null
  readonly useCustom: boolean
  readonly custom: ICustomIntegration
}

interface IShellSlot {
  readonly selectedShell: string | null
  readonly useCustom: boolean
  readonly custom: ICustomIntegration
}

const emptyCustom: ICustomIntegration = {
  name: '',
  path: '',
  arguments: TargetPathArgument,
}

interface IIntegrationsPreferencesProps {
  readonly availableEditors: ReadonlyArray<string>
  readonly selectedExternalEditor: string | null
  readonly availableShells: ReadonlyArray<Shell>
  readonly selectedShell: Shell
  readonly useCustomEditor: boolean
  readonly customEditor: ICustomIntegration
  readonly useCustomShell: boolean
  readonly customShell: ICustomIntegration
  readonly onSelectedEditorChanged: (editor: string) => void
  readonly onSelectedShellChanged: (shell: Shell) => void
  readonly onUseCustomEditorChanged: (useCustomEditor: boolean) => void
  readonly onCustomEditorChanged: (customEditor: ICustomIntegration) => void
  readonly onUseCustomShellChanged: (useCustomShell: boolean) => void
  readonly onCustomShellChanged: (customShell: ICustomIntegration) => void
  readonly customEditors: ReadonlyArray<ICustomIntegration>
  readonly customShells: ReadonlyArray<ICustomIntegration>
  readonly onCustomEditorsChanged: (
    editors: ReadonlyArray<ICustomIntegration>
  ) => void
  readonly onCustomShellsChanged: (
    shells: ReadonlyArray<ICustomIntegration>
  ) => void
}

interface IIntegrationsPreferencesState {
  readonly selectedExternalEditor: string | null
  readonly selectedShell: Shell
  readonly useCustomEditor: boolean
  readonly customEditor: ICustomIntegration
  readonly useCustomShell: boolean
  readonly customShell: ICustomIntegration
  readonly editorSlots: ReadonlyArray<IEditorSlot>
  readonly shellSlots: ReadonlyArray<IShellSlot>
}

function editorSlotsFromCustomEditors(
  customEditors: ReadonlyArray<ICustomIntegration>,
  availableEditors: ReadonlyArray<string>
): IEditorSlot[] {
  return customEditors.map(ce => {
    const detected = availableEditors.find(e => e === ce.name)
    return detected
      ? { selectedEditor: detected, useCustom: false, custom: emptyCustom }
      : { selectedEditor: null, useCustom: true, custom: ce }
  })
}

function shellSlotsFromCustomShells(
  customShells: ReadonlyArray<ICustomIntegration>,
  availableShells: ReadonlyArray<Shell>
): IShellSlot[] {
  return customShells.map(cs => {
    const detected = availableShells.find(s => s === cs.name)
    return detected
      ? { selectedShell: detected, useCustom: false, custom: emptyCustom }
      : { selectedShell: null, useCustom: true, custom: cs }
  })
}

export class Integrations extends React.Component<
  IIntegrationsPreferencesProps,
  IIntegrationsPreferencesState
> {
  private customEditorFormRef = React.createRef<CustomIntegrationForm>()
  private customShellFormRef = React.createRef<CustomIntegrationForm>()

  public constructor(props: IIntegrationsPreferencesProps) {
    super(props)

    this.state = {
      selectedExternalEditor: this.props.selectedExternalEditor,
      selectedShell: this.props.selectedShell,
      useCustomEditor: this.props.useCustomEditor,
      customEditor: this.props.customEditor,
      useCustomShell: this.props.useCustomShell,
      customShell: this.props.customShell,
      editorSlots: editorSlotsFromCustomEditors(
        this.props.customEditors,
        this.props.availableEditors
      ),
      shellSlots: shellSlotsFromCustomShells(
        this.props.customShells,
        this.props.availableShells
      ),
    }
  }

  public async componentWillReceiveProps(
    nextProps: IIntegrationsPreferencesProps
  ) {
    const editors = nextProps.availableEditors
    let selectedExternalEditor = nextProps.selectedExternalEditor
    if (editors.length) {
      const indexOf = selectedExternalEditor
        ? editors.indexOf(selectedExternalEditor)
        : -1
      if (indexOf === -1) {
        selectedExternalEditor = editors[0]
        nextProps.onSelectedEditorChanged(selectedExternalEditor)
      }
    }

    const shells = nextProps.availableShells
    let selectedShell = nextProps.selectedShell
    if (shells.length) {
      const indexOf = shells.indexOf(selectedShell)
      if (indexOf === -1) {
        selectedShell = shells[0]
        nextProps.onSelectedShellChanged(selectedShell)
      }
    }
    this.setState({
      selectedExternalEditor,
      selectedShell,
      useCustomEditor: nextProps.useCustomEditor,
      useCustomShell: nextProps.useCustomShell,
      customShell: nextProps.customShell,
      customEditor: nextProps.customEditor,
    })
  }

  public componentDidMount(): void {
    if (enableCustomIntegration()) {
      const {
        availableEditors,
        availableShells,
        useCustomEditor,
        useCustomShell,
      } = this.props

      if (availableEditors.length === 0 && !useCustomEditor) {
        this.setSelectedEditor(CustomIntegrationValue)
      }

      if (availableShells.length === 0 && !useCustomShell) {
        this.setSelectedShell(CustomIntegrationValue)
      }
    }
  }

  public componentDidUpdate(
    prevProps: IIntegrationsPreferencesProps,
    prevState: IIntegrationsPreferencesState
  ): void {
    if (!prevState.useCustomEditor && this.state.useCustomEditor) {
      this.customEditorFormRef.current?.focus()
    }

    if (!prevState.useCustomShell && this.state.useCustomShell) {
      this.customShellFormRef.current?.focus()
    }
  }

  // --- Primary editor/shell selection (unchanged from original) ---

  private onSelectedEditorChanged = (
    event: React.FormEvent<HTMLSelectElement>
  ) => {
    const value = event.currentTarget.value
    if (!value) {
      return
    }
    this.setSelectedEditor(value)
  }

  private setSelectedEditor = (editor: string) => {
    if (editor === CustomIntegrationValue) {
      this.setState({ useCustomEditor: true })
      this.props.onUseCustomEditorChanged(true)
    } else {
      this.setState({
        useCustomEditor: false,
        selectedExternalEditor: editor,
      })
      this.props.onUseCustomEditorChanged(false)
      this.props.onSelectedEditorChanged(editor)
    }
  }

  private onSelectedShellChanged = (
    event: React.FormEvent<HTMLSelectElement>
  ) => {
    const value = event.currentTarget.value
    if (!value) {
      return
    }
    this.setSelectedShell(value)
  }

  private setSelectedShell = (shell: string) => {
    if (shell === CustomIntegrationValue) {
      this.setState({ useCustomShell: true })
      this.props.onUseCustomShellChanged(true)
    } else {
      const parsedValue = parseShell(shell)
      this.setState({
        useCustomShell: false,
        selectedShell: parsedValue,
      })
      this.props.onSelectedShellChanged(parsedValue)
      this.props.onUseCustomShellChanged(false)
    }
  }

  // --- Render primary editor ---

  private renderExternalEditor() {
    const options = this.props.availableEditors
    const { selectedExternalEditor, useCustomEditor } = this.state
    const label = t(__DARWIN__ ? 'External Editor' : 'External editor')

    if (!enableCustomIntegration() && options.length === 0) {
      return (
        <div className="select-component no-options-found">
          <label>{label}</label>
          <span>
            {t('No editors found.')}{' '}
            <LinkButton uri={suggestedExternalEditor.url}>
              {t('Install {{name}}?', { name: suggestedExternalEditor.name })}
            </LinkButton>
          </span>
        </div>
      )
    }

    return (
      <Select
        label={enableCustomIntegration() ? undefined : label}
        aria-label={t('External editor')}
        value={
          useCustomEditor
            ? CustomIntegrationValue
            : selectedExternalEditor ?? undefined
        }
        onChange={this.onSelectedEditorChanged}
      >
        {options.map(n => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
        {enableCustomIntegration() && (
          <option key={CustomIntegrationValue} value={CustomIntegrationValue}>
            {t(
              __DARWIN__
                ? 'Configure Custom Editor…'
                : 'Configure custom editor…'
            )}
          </option>
        )}
      </Select>
    )
  }

  private renderNoExternalEditorHint() {
    const options = this.props.availableEditors
    if (options.length > 0) {
      return null
    }

    return (
      <Row>
        <div className="no-options-found">
          <span>
            {t('No other editors found.')}{' '}
            <LinkButton uri={suggestedExternalEditor.url}>
              {t('Install {{name}}?', { name: suggestedExternalEditor.name })}
            </LinkButton>
          </span>
        </div>
      </Row>
    )
  }

  private renderCustomExternalEditor() {
    return (
      <Row>
        <CustomIntegrationForm
          id="custom-editor"
          ref={this.customEditorFormRef}
          path={this.state.customEditor.path ?? ''}
          arguments={this.state.customEditor.arguments}
          onPathChanged={this.onCustomEditorPathChanged}
          onArgumentsChanged={this.onCustomEditorArgumentsChanged}
        />
      </Row>
    )
  }

  private onCustomEditorPathChanged = (path: string, bundleID?: string) => {
    const customEditor: ICustomIntegration = {
      name: this.state.customEditor.name,
      path,
      bundleID,
      arguments: this.state.customEditor.arguments ?? [],
    }
    this.setState({ customEditor })
    this.props.onCustomEditorChanged(customEditor)
  }

  private onCustomEditorArgumentsChanged = (args: string) => {
    const customEditor: ICustomIntegration = {
      name: this.state.customEditor.name,
      path: this.state.customEditor.path,
      bundleID: this.state.customEditor.bundleID,
      arguments: args,
    }
    this.setState({ customEditor })
    this.props.onCustomEditorChanged(customEditor)
  }

  // --- Render primary shell ---

  private renderSelectedShell() {
    const options = this.props.availableShells
    const { selectedShell, useCustomShell } = this.state

    return (
      <Select
        label={enableCustomIntegration() ? undefined : t('Shell')}
        aria-label={t('Shell')}
        value={useCustomShell ? CustomIntegrationValue : selectedShell}
        onChange={this.onSelectedShellChanged}
      >
        {options.map(n => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
        {enableCustomIntegration() && (
          <option key={CustomIntegrationValue} value={CustomIntegrationValue}>
            {t(
              __DARWIN__
                ? 'Configure Custom Shell…'
                : 'Configure custom shell…'
            )}
          </option>
        )}
      </Select>
    )
  }

  private renderCustomShell() {
    return (
      <Row>
        <CustomIntegrationForm
          id="custom-shell"
          ref={this.customShellFormRef}
          path={this.state.customShell.path}
          arguments={this.state.customShell.arguments}
          onPathChanged={this.onCustomShellPathChanged}
          onArgumentsChanged={this.onCustomShellArgumentsChanged}
        />
      </Row>
    )
  }

  private onCustomShellPathChanged = (path: string, bundleID?: string) => {
    const customShell: ICustomIntegration = {
      name: this.state.customShell.name,
      path,
      bundleID,
      arguments: this.state.customShell.arguments ?? [],
    }
    this.setState({ customShell })
    this.props.onCustomShellChanged(customShell)
  }

  private onCustomShellArgumentsChanged = (args: string) => {
    const customShell: ICustomIntegration = {
      name: this.state.customShell.name,
      path: this.state.customShell.path ?? '',
      bundleID: this.state.customShell.bundleID,
      arguments: args,
    }
    this.setState({ customShell })
    this.props.onCustomShellChanged(customShell)
  }

  // --- Extra editor slots (each is a full replica of the primary) ---

  private updateEditorSlot(index: number, slot: IEditorSlot) {
    const slots = [...this.state.editorSlots]
    slots[index] = slot
    this.setState({ editorSlots: slots })
    this.emitCustomEditors(slots)
  }

  private removeEditorSlot(index: number) {
    const slots = this.state.editorSlots.filter((_, i) => i !== index)
    this.setState({ editorSlots: slots })
    this.emitCustomEditors(slots)
  }

  private emitCustomEditors(slots: ReadonlyArray<IEditorSlot>) {
    const result: ICustomIntegration[] = []
    for (const slot of slots) {
      if (slot.useCustom) {
        if (slot.custom.path) {
          result.push(slot.custom)
        }
      } else if (slot.selectedEditor) {
        result.push({
          name: slot.selectedEditor,
          path: '',
          arguments: TargetPathArgument,
        })
      }
    }
    this.props.onCustomEditorsChanged(result)
  }

  private renderEditorSlot(slot: IEditorSlot, index: number) {
    const options = this.props.availableEditors
    return (
      <div key={index} className="extra-integration-slot">
        <Row>
          <Select
            aria-label={t('External editor')}
            value={
              slot.useCustom
                ? CustomIntegrationValue
                : slot.selectedEditor ?? undefined
            }
            onChange={e => {
              const value = e.currentTarget.value
              if (value === CustomIntegrationValue) {
                this.updateEditorSlot(index, {
                  ...slot,
                  useCustom: true,
                  selectedEditor: null,
                })
              } else {
                this.updateEditorSlot(index, {
                  selectedEditor: value,
                  useCustom: false,
                  custom: emptyCustom,
                })
              }
            }}
          >
            {options.map(n => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            <option
              key={CustomIntegrationValue}
              value={CustomIntegrationValue}
            >
              {t(
                __DARWIN__
                  ? 'Configure Custom Editor…'
                  : 'Configure custom editor…'
              )}
            </option>
          </Select>
          <Button onClick={() => this.removeEditorSlot(index)}>
            {t('Remove')}
          </Button>
        </Row>
        {slot.useCustom && (
          <Row>
            <CustomIntegrationForm
              id={`extra-editor-${index}`}
              path={slot.custom.path}
              arguments={slot.custom.arguments}
              name={slot.custom.name}
              onNameChanged={name =>
                this.updateEditorSlot(index, {
                  ...slot,
                  custom: { ...slot.custom, name },
                })
              }
              onPathChanged={(path, bundleID) =>
                this.updateEditorSlot(index, {
                  ...slot,
                  custom: { ...slot.custom, path, bundleID },
                })
              }
              onArgumentsChanged={args =>
                this.updateEditorSlot(index, {
                  ...slot,
                  custom: { ...slot.custom, arguments: args },
                })
              }
            />
          </Row>
        )}
      </div>
    )
  }

  // --- Extra shell slots ---

  private updateShellSlot(index: number, slot: IShellSlot) {
    const slots = [...this.state.shellSlots]
    slots[index] = slot
    this.setState({ shellSlots: slots })
    this.emitCustomShells(slots)
  }

  private removeShellSlot(index: number) {
    const slots = this.state.shellSlots.filter((_, i) => i !== index)
    this.setState({ shellSlots: slots })
    this.emitCustomShells(slots)
  }

  private emitCustomShells(slots: ReadonlyArray<IShellSlot>) {
    const result: ICustomIntegration[] = []
    for (const slot of slots) {
      if (slot.useCustom) {
        if (slot.custom.path) {
          result.push(slot.custom)
        }
      } else if (slot.selectedShell) {
        result.push({
          name: slot.selectedShell,
          path: '',
          arguments: TargetPathArgument,
        })
      }
    }
    this.props.onCustomShellsChanged(result)
  }

  private renderShellSlot(slot: IShellSlot, index: number) {
    const options = this.props.availableShells
    return (
      <div key={index} className="extra-integration-slot">
        <Row>
          <Select
            aria-label={t('Shell')}
            value={
              slot.useCustom
                ? CustomIntegrationValue
                : slot.selectedShell ?? undefined
            }
            onChange={e => {
              const value = e.currentTarget.value
              if (value === CustomIntegrationValue) {
                this.updateShellSlot(index, {
                  ...slot,
                  useCustom: true,
                  selectedShell: null,
                })
              } else {
                this.updateShellSlot(index, {
                  selectedShell: value,
                  useCustom: false,
                  custom: emptyCustom,
                })
              }
            }}
          >
            {options.map(n => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            <option
              key={CustomIntegrationValue}
              value={CustomIntegrationValue}
            >
              {t(
                __DARWIN__
                  ? 'Configure Custom Shell…'
                  : 'Configure custom shell…'
              )}
            </option>
          </Select>
          <Button onClick={() => this.removeShellSlot(index)}>
            {t('Remove')}
          </Button>
        </Row>
        {slot.useCustom && (
          <Row>
            <CustomIntegrationForm
              id={`extra-shell-${index}`}
              path={slot.custom.path}
              arguments={slot.custom.arguments}
              name={slot.custom.name}
              onNameChanged={name =>
                this.updateShellSlot(index, {
                  ...slot,
                  custom: { ...slot.custom, name },
                })
              }
              onPathChanged={(path, bundleID) =>
                this.updateShellSlot(index, {
                  ...slot,
                  custom: { ...slot.custom, path, bundleID },
                })
              }
              onArgumentsChanged={args =>
                this.updateShellSlot(index, {
                  ...slot,
                  custom: { ...slot.custom, arguments: args },
                })
              }
            />
          </Row>
        )}
      </div>
    )
  }

  // --- Main render ---

  public render() {
    if (!enableCustomIntegration()) {
      return (
        <DialogContent>
          <h2>{t('Applications')}</h2>
          <Row>{this.renderExternalEditor()}</Row>
          <Row>{this.renderSelectedShell()}</Row>
        </DialogContent>
      )
    }

    return (
      <DialogContent>
        <fieldset>
          <legend>
            <h2>{t(__DARWIN__ ? 'External Editor' : 'External editor')}</h2>
          </legend>
          <Row>{this.renderExternalEditor()}</Row>
          {this.state.useCustomEditor && this.renderCustomExternalEditor()}
          {this.renderNoExternalEditorHint()}
          {this.state.editorSlots.map((slot, i) =>
            this.renderEditorSlot(slot, i)
          )}
          <Row className="add-integration-row">
            <Button
              onClick={() =>
                this.setState({
                  editorSlots: [
                    ...this.state.editorSlots,
                    {
                      selectedEditor:
                        this.props.availableEditors[0] ?? null,
                      useCustom: false,
                      custom: emptyCustom,
                    },
                  ],
                })
              }
            >
              {t(__DARWIN__ ? 'Add External Editor' : 'Add external editor')}
            </Button>
          </Row>
        </fieldset>
        <fieldset>
          <legend>
            <h2>{t('Shell')}</h2>
          </legend>
          <Row>{this.renderSelectedShell()}</Row>
          {this.state.useCustomShell && this.renderCustomShell()}
          {this.state.shellSlots.map((slot, i) =>
            this.renderShellSlot(slot, i)
          )}
          <Row className="add-integration-row">
            <Button
              onClick={() =>
                this.setState({
                  shellSlots: [
                    ...this.state.shellSlots,
                    {
                      selectedShell:
                        this.props.availableShells[0] ?? null,
                      useCustom: false,
                      custom: emptyCustom,
                    },
                  ],
                })
              }
            >
              {t(__DARWIN__ ? 'Add Shell' : 'Add shell')}
            </Button>
          </Row>
        </fieldset>
      </DialogContent>
    )
  }
}
