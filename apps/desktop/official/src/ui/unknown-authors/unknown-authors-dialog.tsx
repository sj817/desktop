import * as React from 'react'

import { t } from '@i18n'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { PathText } from '../lib/path-text'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { UnknownAuthor } from '../../models/author'

interface IUnknownAuthorsProps {
  readonly authors: ReadonlyArray<UnknownAuthor>
  readonly onCommit: () => void
  readonly onDismissed: () => void
}

/**
 * Don't list more than this number of authors.
 */
const MaxAuthorsToList = 10

/** A component to confirm commit when unknown co-authors were added. */
export class UnknownAuthors extends React.Component<IUnknownAuthorsProps> {
  public constructor(props: IUnknownAuthorsProps) {
    super(props)
  }

  public render() {
    return (
      <Dialog
        id="unknown-authors"
        title={t(__DARWIN__ ? 'Unknown Co-Authors' : 'Unknown co-authors')}
        onDismissed={this.props.onDismissed}
        onSubmit={this.commit}
        type="warning"
      >
        <DialogContent>{this.renderAuthorList()}</DialogContent>

        <DialogFooter>
          <OkCancelButtonGroup
            destructive={true}
            okButtonText={t(__DARWIN__ ? 'Commit Anyway' : 'Commit anyway')}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private renderAuthorList() {
    if (this.props.authors.length > MaxAuthorsToList) {
      return (
        <p>
          {t(
            "{{count}} users weren't found and won't be added as co-authors of this commit. Are you sure you want to commit?",
            { count: this.props.authors.length }
          )}
        </p>
      )
    } else {
      return (
        <div>
          <p>
            {t(
              "These users weren't found and won't be added as co-authors of this commit. Are you sure you want to commit?"
            )}
          </p>
          <div className="author-list">
            <ul>
              {this.props.authors.map(a => (
                <li key={a.username}>
                  <PathText path={a.username} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      )
    }
  }

  private commit = async () => {
    this.props.onCommit()
    this.props.onDismissed()
  }
}
