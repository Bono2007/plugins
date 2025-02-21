// @flow
// --------------------------------------------------------------------------
// Dashboard React component to show the Header at the top of the Dashboard window.
// Called by Dashboard component.
// Last updated 2025-02-21 for 2.2.0
// --------------------------------------------------------------------------

// --------------------------------------------------------------------------
// Imports
// --------------------------------------------------------------------------
import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { createDashboardSettingsItems } from '../../../dashboardSettings.js'
import { getVisibleSectionCodes } from '../Section/sectionHelpers.js'
import { useSettingsDialogHandler } from '../../customHooks/useSettingsDialogHandler.jsx'
import { useAppContext } from '../AppContext.jsx'
import DropdownMenu from '../DropdownMenu.jsx'
import SettingsDialog from '../SettingsDialog.jsx'
import RefreshControl from '../RefreshControl.jsx'
import { DASHBOARD_ACTIONS } from '../../reducers/actionTypes'
import DoneCounts from './DoneCounts.jsx'
import { createFeatureFlagItems } from './featureFlagItems.js'
import { createFilterDropdownItems } from './filterDropdownItems.js'
import PerspectiveSelector from './PerspectiveSelector.jsx'
import SearchBar from './SearchBar.jsx'
import useLastFullRefresh from './useLastFullRefresh.js'
import { clo, logDebug, logInfo } from '@helpers/react/reactDev.js'
import ModalWithTooltip from '@helpers/react/Modal/ModalWithTooltip.jsx'
import './Header.css'

// --------------------------------------------------------------------------
// Type Definitions
// --------------------------------------------------------------------------

type Props = {
  lastFullRefresh: Date,
}

/**
 * Header Component to display the dashboard header.
 * @component
 * @param {Props} props - The props object.
 * @param {Date} props.lastFullRefresh - The timestamp of the last full refresh.
 * @returns {React.Node} The rendered Header component.
 */
const Header = ({ lastFullRefresh }: Props): React$Node => {
  // ----------------------------------------------------------------------
  // Context
  // ----------------------------------------------------------------------
  const { dashboardSettings, dispatchDashboardSettings, sendActionToPlugin, pluginData } = useAppContext()

  // ----------------------------------------------------------------------
  // Hooks
  // ----------------------------------------------------------------------
  const timeAgo = useLastFullRefresh(lastFullRefresh)

  // ----------------------------------------------------------------------
  // State
  // ----------------------------------------------------------------------
  const [openDropdownMenu, setOpenDropdownMenu] = useState<string | null>(null)
  const [tempDashboardSettings, setTempDashboardSettings] = useState({ ...dashboardSettings }) // for queuing up changes from dropdown menu to be applied when it is closed
  const { isDialogOpen, handleToggleDialog } = useSettingsDialogHandler(sendActionToPlugin)

  // ----------------------------------------------------------------------
  // Effects
  // ----------------------------------------------------------------------
  /**
   * Synchronize tempDashboardSettings with dashboardSettings when the dropdown menu is not open.
   */
  useEffect(() => {
    logDebug(`Header/useEffect dashboardSettings or openDropdownMenu changed. openDropdownMenu=${String(openDropdownMenu)}`, { dashboardSettings })
    if (!openDropdownMenu) {
      logDebug(`Header/useEffect dashboardSettings or openDropdownMenu changed memo. openDropdownMenu=${String(openDropdownMenu)}`, { dashboardSettings })
      setTempDashboardSettings({ ...dashboardSettings })
    }
  }, [dashboardSettings, openDropdownMenu])

  // ----------------------------------------------------------------------
  // Handlers
  // ----------------------------------------------------------------------
  /**
   * Toggles the open/closed state of a dropdown menu.
   * @param {string} dropdown - The identifier of the dropdown menu to toggle.
   */
  const handleToggleDropdownMenu = useCallback(
    (dropdown: string) => {
      console.log('Header/handleToggleDropdownMenu', `Toggling dropdown menu: "${dropdown}"; current openDropdownMenu=${String(openDropdownMenu)}`)
      if (openDropdownMenu === dropdown) {
        // Closing the dropdown menu
        logDebug('Header/handleToggleDropdownMenu', `Closing dropdown menu ${dropdown}`)
        // handleChangesInSettings()
        setOpenDropdownMenu(null)
        setTempDashboardSettings({ ...dashboardSettings }) // Reset temp settings
      } else {
        // Opening a new dropdown menu
        logDebug('Header/handleToggleDropdownMenu', `Opening dropdown menu ${dropdown}`)
        setOpenDropdownMenu(dropdown)
        setTempDashboardSettings({ ...dashboardSettings }) // Initialize temp settings
      }
    },
    [openDropdownMenu, dashboardSettings],
  )

  /**
   * Handles changes in settings when user saves changes from the dropdown menu or settings dialog.
   */
  const handleChangesInSettings = useCallback(
    (updatedSettings?: Object) => {
      const newSettings = {
        ...dashboardSettings,
        ...tempDashboardSettings,
        ...updatedSettings,
      }
      dispatchDashboardSettings({
        type: DASHBOARD_ACTIONS.UPDATE_DASHBOARD_SETTINGS,
        payload: newSettings,
        reason: `Dashboard Settings updated`,
      })
      // Update tempDashboardSettings with the new settings
      setTempDashboardSettings(newSettings)
    },
    [dashboardSettings, tempDashboardSettings, dispatchDashboardSettings],
  )

  /**
   * Handles switch change in the dropdown menu.
   */
  const handleLocalSwitchChange =
    (key: string) =>
    (e: any): void => {
      const isChecked = e?.target?.checked || false
      logDebug('Header/handleLocalSwitchChange', `Changing setting ${key} to ${isChecked}`)
      setTempDashboardSettings((prevSettings) => ({
        ...prevSettings,
        [key]: isChecked,
      }))
    }

  /**
   * Handles input save in the dropdown menu.
   */
  const handleLocalSaveInput =
    (key: string) =>
    (newValue: string): void => {
      logDebug('Header/handleLocalSaveInput', `Changing setting ${key} to ${newValue}`)
      setTempDashboardSettings((prevSettings) => ({
        ...prevSettings,
        [key]: newValue,
      }))
    }

  /**
   * Handles the click event for the refresh button, triggering a plugin refresh action.
   *
   * @param {boolean} isHardRefresh - If true, performs a hard refresh.
   * @returns {Function} - A function to handle the click event.
   */
  const handleRefreshClick =
    (isHardRefresh: boolean = false): Function =>
    (): void => {
      const actionType = isHardRefresh ? 'windowReload' : 'refreshEnabledSections'
      logDebug('Header', `Refresh button clicked; isHardRefresh:${String(isHardRefresh)} sending action:${actionType}`)
      sendActionToPlugin(actionType, { actionType: actionType, sectionCodes: visibleSectionCodes }, 'Refresh button clicked', true)
    }

  /**
   * Handles the search event.
   * @param {string} query - The search query.
   */
  const handleSearch = (query: string): void => {
    console.log('Search query:', query)
    // Add your search logic here
  }

  // ----------------------------------------------------------------------
  // Constants
  // ----------------------------------------------------------------------
  const { sections, logSettings, firstRun } = pluginData

  const visibleSectionCodes = getVisibleSectionCodes(dashboardSettings, sections)

  // Memoized dropdown items that update when tempDashboardSettings changes
  const [dropdownSectionItems, dropdownOtherItems] = useMemo(() => createFilterDropdownItems(tempDashboardSettings), [tempDashboardSettings])
  const dashboardSettingsItems = useMemo(() => createDashboardSettingsItems(tempDashboardSettings), [tempDashboardSettings])
  const featureFlagItems = useMemo(() => createFeatureFlagItems(tempDashboardSettings), [tempDashboardSettings])

  const isDevMode = logSettings._logLevel === 'DEV'
  const showRefreshButton = pluginData.platform !== 'iOS'
  const showHardRefreshButton = isDevMode && dashboardSettings?.FFlag_HardRefreshButton && showRefreshButton
  const isMobile = pluginData.platform !== 'macOS'
  const isNarrowWidth = window.innerWidth <= 680

  // ----------------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------------
  const timeAgoText = isMobile || isNarrowWidth ? timeAgo : timeAgo.replace(' mins', 'm').replace(' min', 'm').replace(' hours', 'h').replace(' hour', 'h')
  // logInfo('Header', `Rendering Header; isMobile:${String(isMobile)}, isNarrowWidth:${String(isNarrowWidth)}, showRefreshButton:${String(showRefreshButton)}, showHardRefreshButton:${String(showHardRefreshButton)}`)
  return (
    <header className="header">
      {/* Perspective selector */}
      {dashboardSettings.perspectivesEnabled && (
        <div className="perspectiveName">
          <PerspectiveSelector />
        </div>
      )}

      {showRefreshButton && (
        <div className="refreshButtons">
          <RefreshControl refreshing={pluginData.refreshing === true} firstRun={firstRun} handleRefreshClick={handleRefreshClick(false)} />
          {showHardRefreshButton && (
            <button onClick={handleRefreshClick(true)} className="HAButton hardRefreshButton">
              <i className={'fa-regular fa-arrows-retweet'}></i>
              <span className="pad-left">{isNarrowWidth ? 'HR' : 'Hard Refresh'}</span>
            </button>
          )}
        </div>
      )}

      {!(isMobile || isNarrowWidth) && (
        <div className="lastRefreshInfo">
          {/* <> */}
          Updated: <span id="timer">{timeAgoText}</span>
          {/* </> */}
        </div>
      )}

      {/* TODO: use this to test out modals + tooltips. Needs a trigger button first. */}
      {/* <div>
        <ModalWithTooltip
          tooltipTextNoModifier="tooltip with no extra key pressed"
          tooltipTextCmdModifier="tooltip with ⌘ key pressed"
        />
      </div>
 */}
      {!(isMobile || isNarrowWidth) && (
        <div className="totalCounts">{dashboardSettings.displayDoneCounts && pluginData?.totalDoneCount ? <DoneCounts totalDoneCount={pluginData.totalDoneCount} /> : ''}</div>
      )}

      <SearchBar onSearch={handleSearch} />

      {/* Feature Flags dropdown */}
      {isDevMode && (
        <DropdownMenu
          onSaveChanges={handleChangesInSettings}
          otherItems={featureFlagItems}
          handleSwitchChange={handleLocalSwitchChange}
          className={'feature-flags'}
          iconClass="fa-solid fa-flag"
          isOpen={openDropdownMenu === 'featureFlags'}
          toggleMenu={() => handleToggleDropdownMenu('featureFlags')}
          labelPosition="left"
        />
      )}
        {/* Render the SettingsDialog only when it is open */}
        {isDialogOpen && (
          <SettingsDialog
            items={dashboardSettingsItems}
            className={'dashboard-settings'}
            isOpen={isDialogOpen}
            toggleDialog={handleToggleDialog}
            onSaveChanges={handleChangesInSettings}
          />
        )}
        {/* Display toggles dropdown menu */}
        <DropdownMenu
          onSaveChanges={handleChangesInSettings}
          sectionItems={dropdownSectionItems}
          otherItems={dropdownOtherItems}
          handleSwitchChange={handleLocalSwitchChange}
          handleSaveInput={handleLocalSaveInput}
          className={'filter'}
          iconClass="fa-solid fa-filter"
          isOpen={openDropdownMenu === 'filter'}
          toggleMenu={() => handleToggleDropdownMenu('filter')}
          labelPosition="left"
        />
        {/* Cog Icon for opening the settings dialog */}
        <div className="dropdown">
          <i className="fa-solid fa-gear" onClick={handleToggleDialog}></i>
        </div>

    </header>
  )
}

export default Header
