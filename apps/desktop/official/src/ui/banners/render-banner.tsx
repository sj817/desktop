import * as React from 'react'

import { t } from '@i18n'

import { assertNever } from '../../lib/fatal-error'

import { Banner, BannerType } from '../../models/banner'

import { Dispatcher } from '../dispatcher'
import { MergeConflictsBanner } from './merge-conflicts-banner'

import { SuccessfulMerge } from './successful-merge'
import { RebaseConflictsBanner } from './rebase-conflicts-banner'
import { SuccessfulRebase } from './successful-rebase'
import { BranchAlreadyUpToDate } from './branch-already-up-to-date-banner'
import { SuccessfulCherryPick } from './successful-cherry-pick'
import { CherryPickConflictsBanner } from './cherry-pick-conflicts-banner'
import { CherryPickUndone } from './cherry-pick-undone'
import { OpenThankYouCard } from './open-thank-you-card'
import { SuccessfulSquash } from './successful-squash'
import { SuccessBanner } from './success-banner'
import { ConflictsFoundBanner } from './conflicts-found-banner'
import { OSVersionNoLongerSupportedBanner } from './os-version-no-longer-supported-banner'

export function renderBanner(
  banner: Banner,
  dispatcher: Dispatcher,
  onDismissed: () => void
): JSX.Element {
  switch (banner.type) {
    case BannerType.SuccessfulMerge:
      return (
        <SuccessfulMerge
          ourBranch={banner.ourBranch}
          theirBranch={banner.theirBranch}
          onDismissed={onDismissed}
          key={'successful-merge'}
        />
      )
    case BannerType.MergeConflictsFound:
      return (
        <MergeConflictsBanner
          dispatcher={dispatcher}
          ourBranch={banner.ourBranch}
          popup={banner.popup}
          onDismissed={onDismissed}
          key={'merge-conflicts'}
        />
      )
    case BannerType.SuccessfulRebase:
      return (
        <SuccessfulRebase
          targetBranch={banner.targetBranch}
          baseBranch={banner.baseBranch}
          onDismissed={onDismissed}
          key={'successful-rebase'}
        />
      )
    case BannerType.RebaseConflictsFound:
      return (
        <RebaseConflictsBanner
          dispatcher={dispatcher}
          targetBranch={banner.targetBranch}
          onOpenDialog={banner.onOpenDialog}
          onDismissed={onDismissed}
          key={'merge-conflicts'}
        />
      )
    case BannerType.BranchAlreadyUpToDate:
      return (
        <BranchAlreadyUpToDate
          ourBranch={banner.ourBranch}
          theirBranch={banner.theirBranch}
          onDismissed={onDismissed}
          key={'branch-already-up-to-date'}
        />
      )
    case BannerType.SuccessfulCherryPick:
      return (
        <SuccessfulCherryPick
          key="successful-cherry-pick"
          targetBranchName={banner.targetBranchName}
          countCherryPicked={banner.count}
          onDismissed={onDismissed}
          onUndo={banner.onUndo}
        />
      )
    case BannerType.CherryPickConflictsFound:
      return (
        <CherryPickConflictsBanner
          targetBranchName={banner.targetBranchName}
          onOpenConflictsDialog={banner.onOpenConflictsDialog}
          onDismissed={onDismissed}
          key={'cherry-pick-conflicts'}
        />
      )
    case BannerType.CherryPickUndone:
      return (
        <CherryPickUndone
          key="cherry-pick-undone"
          targetBranchName={banner.targetBranchName}
          countCherryPicked={banner.countCherryPicked}
          onDismissed={onDismissed}
        />
      )
    case BannerType.OpenThankYouCard:
      return (
        <OpenThankYouCard
          key="open-thank-you-card"
          emoji={banner.emoji}
          onDismissed={onDismissed}
          onOpenCard={banner.onOpenCard}
          onThrowCardAway={banner.onThrowCardAway}
        />
      )
    case BannerType.SuccessfulSquash:
      return (
        <SuccessfulSquash
          key="successful-squash"
          count={banner.count}
          onDismissed={onDismissed}
          onUndo={banner.onUndo}
        />
      )
    case BannerType.SquashUndone: {
      const count = banner.commitsCount
      return (
        <SuccessBanner
          key="squash-undone"
          timeout={5000}
          onDismissed={onDismissed}
        >
          {t(
            count === 1
              ? 'Squash of {{count}} commit undone.'
              : 'Squash of {{count}} commits undone.',
            { count }
          )}
        </SuccessBanner>
      )
    }
    case BannerType.SuccessfulReorder: {
      const count = banner.count

      return (
        <SuccessBanner
          key="successful-reorder"
          timeout={15000}
          onDismissed={onDismissed}
          onUndo={banner.onUndo}
        >
          <span>
            {t(
              count === 1
                ? 'Successfully reordered {{count}} commit.'
                : 'Successfully reordered {{count}} commits.',
              { count }
            )}
          </span>
        </SuccessBanner>
      )
    }
    case BannerType.ReorderUndone: {
      const count = banner.commitsCount
      return (
        <SuccessBanner
          key="reorder-undone"
          timeout={5000}
          onDismissed={onDismissed}
        >
          {t(
            count === 1
              ? 'Reorder of {{count}} commit undone.'
              : 'Reorder of {{count}} commits undone.',
            { count }
          )}
        </SuccessBanner>
      )
    }
    case BannerType.ConflictsFound:
      return (
        <ConflictsFoundBanner
          operationDescription={banner.operationDescription}
          onOpenConflictsDialog={banner.onOpenConflictsDialog}
          onDismissed={onDismissed}
          key={'conflicts-found'}
        ></ConflictsFoundBanner>
      )
    case BannerType.OSVersionNoLongerSupported:
      return <OSVersionNoLongerSupportedBanner onDismissed={onDismissed} />
    default:
      return assertNever(banner, `Unknown popup type: ${banner}`)
  }
}
