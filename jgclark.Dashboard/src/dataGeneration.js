// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main function to generate data
// Last updated 2025-04-01 for v2.2.0.a10, @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import type { TDashboardSettings, TParagraphForDashboard, TSectionCode, TSection, TSectionItem, TSectionDetails, TSettingItem } from './types'
import { allSectionCodes } from './constants.js'
import { getNumCompletedTasksTodayFromNote } from './countDoneTasks'
import {
  createSectionOpenItemsFromParas,
  createSectionItemObject,
  getDashboardSettings,
  // getDisplayListOfSectionCodes,
  getListOfEnabledSections,
  getNotePlanSettings,
  getOpenItemParasForTimePeriod,
  getRelevantOverdueTasks,
  getRelevantPriorityTasks,
  isLineDisallowedByExcludedTerms,
  makeDashboardParas,
} from './dashboardHelpers'
import { getTodaySectionData, getYesterdaySectionData, getTomorrowSectionData } from './dataGenerationDays'
import { getProjectSectionData } from './dataGenerationProjects'
import { getSavedSearchResults } from './dataGenerationSearch'
import { getLastWeekSectionData, getThisWeekSectionData } from './dataGenerationWeeks'
import { openMonthParas, refMonthParas, tagParasFromNote } from './demoData'
import { getTagSectionDetails } from './react/components/Section/sectionHelpers'
import { removeInvalidTagSections } from './perspectiveHelpers'
import { getNotesWithTagOrMention } from './tagMentionCache'
import { getDateStringFromCalendarFilename, getNPMonthStr, getNPQuarterStr, filenameIsInFuture, includesScheduledFutureDate } from '@helpers/dateTime'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import { percent } from '@helpers/general'
import { getNoteByFilename } from '@helpers/note'
import { findNotesMatchingHashtagOrMention, getHeadingsFromNote } from '@helpers/NPnote'
import { sortListBy } from '@helpers/sorting'
import { eliminateDuplicateSyncedParagraphs } from '@helpers/syncedCopies'
import { isOpen, isOpenTask, removeDuplicates } from '@helpers/utils'

//-----------------------------------------------------------------

/**
 * Generate data for all the sections (that the user currently wants)
 * Note: don't forget there's also refreshClickHandlers.js::refreshAllSections().
 * @param {boolean} useDemoData? (default: false)
 * @param {boolean} useEditorWherePossible?
 * @returns {Array<TSection>} array of sections
 */
export async function getAllSectionsData(useDemoData: boolean = false, forceLoadAll: boolean = false, useEditorWherePossible: boolean): Promise<Array<TSection>> {
  try {
    const config: any = await getDashboardSettings()
    // clo(config, 'getAllSectionsData config is currently',2)

    // V2
    // Work out which sections to show
    const sectionsToShow: Array<TSectionCode> = forceLoadAll ? allSectionCodes : getListOfEnabledSections(config)
    logDebug('getAllSectionsData', `>>>>> Starting with ${String(sectionsToShow.length)} sections to show: ${String(sectionsToShow)}`)
    const sections: Array<TSection> = await getSomeSectionsData(sectionsToShow, useDemoData, useEditorWherePossible)
    // logDebug('getAllSectionsData', `=> sections ${getDisplayListOfSectionCodes(sections)} (unfiltered)`)
    logDebug('getAllSectionsData', `<<<<< Finished`)

    return sections.filter((s) => s) //get rid of any nulls b/c some of the sections above could return null
  } catch (error) {
    logError('getAllSectionsData', error.message)
    return []
  }
}

/**
 * Generate data for some specified sections (subject to user currently wanting them as well).
 * Note: Returns all wanted sections in one go.
 * Note: don't forget there's also refreshClickHandlers.js::incrementallyRefreshSomeSections() and refreshSomeSections()
 * @param {Array<string>} sectionCodesToGet (default: allSectionCodes)
 * @param {boolean} useDemoData (default: false)
 * @param {boolean} useEditorWherePossible?
 * @returns {Array<TSection>} array of sections
 */
export async function getSomeSectionsData(
  sectionCodesToGet: Array<TSectionCode> = allSectionCodes,
  useDemoData: boolean = false,
  useEditorWherePossible: boolean,
): Promise<Array<TSection>> {
  try {
    logDebug('getSomeSectionsData', `🔹Starting with ${sectionCodesToGet.toString()} ...`)
    const config: TDashboardSettings = await getDashboardSettings()

    const sections: Array<TSection> = []
    // v2: for Timeblocks, now done inside getTodaySectionData()
    if (sectionCodesToGet.includes('DT') || sectionCodesToGet.includes('TB')) sections.push(...getTodaySectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('DY') && config.showYesterdaySection) sections.push(...getYesterdaySectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('DO') && config.showTomorrowSection) sections.push(...getTomorrowSectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('LW') && config.showLastWeekSection) sections.push(...getLastWeekSectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('W') && config.showWeekSection) sections.push(...getThisWeekSectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('M') && config.showMonthSection) sections.push(...getThisMonthSectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('Q') && config.showQuarterSection) sections.push(...getThisQuarterSectionData(config, useDemoData, useEditorWherePossible))
    // moderately quick to generate
    if (sectionCodesToGet.includes('PROJ') && config.showProjectSection) {
      const projectSection = await getProjectSectionData(config, useDemoData)
      if (projectSection) sections.push(projectSection)
    }
    // The rest can all be slow to generate
    if (sectionCodesToGet.includes('SAVEDSEARCH')) sections.push(...(await getSavedSearchResults(config, useDemoData)))
    if (sectionCodesToGet.includes('TAG') && config.tagsToShow) {
      // v1:
      // const tagSections = getTaggedSections(config, useDemoData).filter((s) => s) //get rid of any nulls
      // sections = tagSections.length ? sections.concat(tagSections) : sections

      // v2:
      const tagSections = getTagSectionDetails(removeInvalidTagSections(config))
      clo(tagSections, 'getSomeSectionsData tagSections')
      let index = 0
      for (const tagSection of tagSections) {
        // $FlowIgnore[invalid-computed-prop]
        const showSettingForTag = config[tagSection.showSettingName]
        logDebug('getTaggedSections', `💚 sectionDetail.sectionName=${tagSection.sectionName} showSettingForTag=${showSettingForTag}`)
        if (typeof showSettingForTag === 'undefined' || showSettingForTag) {
          const newSection = await getTaggedSectionData(config, useDemoData, tagSection, index)
          if (newSection) sections.push(newSection)
          index++
        }
      }
    }
    if (sectionCodesToGet.includes('OVERDUE') && config.showOverdueSection) sections.push(await getOverdueSectionData(config, useDemoData))
    if (sectionCodesToGet.includes('PRIORITY') && config.showPrioritySection) sections.push(await getPrioritySectionData(config, useDemoData))

    // logDebug('getSomeSectionData', `=> 🔹 sections ${getDisplayListOfSectionCodes(sections)} (unfiltered)`)

    sections.filter((s) => s) //get rid of any nulls b/c just in case any the sections above could return null
    return sections
  } catch (error) {
    logError('getSomeSectionData', error.message)
    return []
  }
}

/**
 * Get open items from this Month's note
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @param {boolean} useEditorWherePossible?
 * @returns {TSection} data
 */
export function getThisMonthSectionData(config: TDashboardSettings, useDemoData: boolean = false, useEditorWherePossible: boolean): Array<TSection> {
  try {
    let sectionNumStr = '8'
    const thisSectionCode = 'M'
    const sections: Array<TSection> = []
    let items: Array<TSectionItem> = []
    let itemCount = 0
    const today = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone
    const dateStr = getNPMonthStr(today)
    const NPSettings = getNotePlanSettings()
    const currentMonthlyNote = DataStore.calendarNoteByDate(today, 'month')
    const thisFilename = `${dateStr}.${NPSettings.defaultFileExtension}`
    let sortedOrCombinedParas: Array<TParagraphForDashboard> = []
    let sortedRefParas: Array<TParagraphForDashboard> = []
    logInfo('getDataForDashboard', `---------- Gathering Month's ${useDemoData ? 'DEMO' : ''} items for section #${String(sectionNumStr)} ------------`)
    const startTime = new Date() // for timing only

    if (useDemoData) {
      const sortedParas = config.separateSectionForReferencedNotes ? openMonthParas : openMonthParas.concat(refMonthParas)
      // Note: parentID already supplied
      sortedParas.map((item) => {
        const thisID = `${sectionNumStr}-${itemCount}`
        items.push({ ID: thisID, ...item })
        itemCount++
      })
    } else {
      if (currentMonthlyNote) {
        // const thisFilename = currentMonthlyNote?.filename ?? '(error)'
        const dateStr = getDateStringFromCalendarFilename(thisFilename)
        if (!thisFilename.includes(dateStr)) {
          logError('getThisMonthSectionData', `- filename '${thisFilename}' but '${dateStr}' ??`)
        }

        // Get list of open tasks/checklists from this calendar note
        ;[sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForTimePeriod('month', currentMonthlyNote, config, useEditorWherePossible)

        // // write one combined section
        // sortedOrCombinedParas.map((p) => {
        //   const thisID = `${sectionNumStr}-${itemCount}`
        //   items.push(createSectionItemObject(thisID, p))
        //   itemCount++
        // })
        // Iterate and write items for first (or combined) section
        items = createSectionOpenItemsFromParas(sortedOrCombinedParas, sectionNumStr)
        itemCount += items.length

        logTimer('getDataForDashboard', startTime, `- finished finding monthly items from ${dateStr}`)
      } else {
        logDebug('getDataForDashboard', `No monthly note found for filename '${thisFilename}'`)
      }
    }
    const nextPeriodNote = DataStore.calendarNoteByDate(new moment().add(1, 'month').toDate(), 'month')
    const nextPeriodFilename = nextPeriodNote?.filename ?? '(error)'
    const doneCountData = getNumCompletedTasksTodayFromNote(thisFilename, true)

    // Set up formFields for the 'add buttons' (applied in Section.jsx)
    const formFieldsBase: Array<TSettingItem> = [{ type: 'input', label: 'Task:', key: 'text', focus: true }]
    const thisMonthHeadings: Array<string> = currentMonthlyNote ? getHeadingsFromNote(currentMonthlyNote, false, true, true, true) : []
    const nextMonthHeadings: Array<string> = nextPeriodNote ? getHeadingsFromNote(nextPeriodNote, false, true, true, true) : []
    // Set the default heading to add to, unless it's '<<carry forward>>', in which case we'll use an empty string
    const defaultHeadingToAddTo: string = config.newTaskSectionHeading !== '<<carry forward>>' ? config.newTaskSectionHeading : ''
    const thisMonthFormFields: Array<TSettingItem> = formFieldsBase.concat(
      thisMonthHeadings.length
        ? // $FlowIgnore[incompatible-type]
          [
            {
              type: 'dropdown-select',
              label: 'Under Heading:',
              key: 'heading',
              // $FlowFixMe[incompatible-type]
              options: thisMonthHeadings,
              noWrapOptions: true,
              value: defaultHeadingToAddTo,
            },
          ]
        : [],
    )
    const nextMonthFormFields: Array<TSettingItem> = formFieldsBase.concat(
      nextMonthHeadings.length
        ? // $FlowIgnore[incompatible-type]
          [
            {
              type: 'dropdown-select',
              label: 'Under Heading:',
              key: 'heading',
              // $FlowFixMe[incompatible-type]
              options: nextMonthHeadings,
              noWrapOptions: true,
              value: defaultHeadingToAddTo,
            },
          ]
        : [],
    )

    const section: TSection = {
      ID: sectionNumStr,
      name: 'This Month',
      showSettingName: 'showMonthSection',
      sectionCode: thisSectionCode,
      description: `{count} from ${dateStr}`,
      FAIconClass: 'fa-light fa-calendar-range',
      sectionTitleColorPart: 'sidebarMonthly',
      sectionFilename: thisFilename,
      sectionItems: items,
      generatedDate: new Date(),
      doneCounts: doneCountData,
      actionButtons: [
        {
          actionName: 'addTask',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a new task to this month's note",
          display: '<i class= "fa-regular fa-fw  fa-circle-plus sidebarMonthly" ></i> ',
          actionParam: thisFilename,
          postActionRefresh: ['M'],
          formFields: thisMonthFormFields,
          submitOnEnter: true,
          submitButtonText: 'Add & Close',
        },
        {
          actionName: 'addChecklist',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a checklist item to this month's note",
          display: '<i class= "fa-regular fa-fw  fa-square-plus sidebarMonthly" ></i> ',
          actionParam: thisFilename,
          postActionRefresh: ['M'],
          formFields: thisMonthFormFields,
          submitOnEnter: true,
          submitButtonText: 'Add & Close',
        },
        {
          actionName: 'addTask',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a new task to next month's note",
          display: '<i class= "fa-regular fa-fw  fa-circle-arrow-right sidebarMonthly" ></i> ',
          actionParam: nextPeriodFilename,
          formFields: nextMonthFormFields,
          submitOnEnter: true,
          submitButtonText: 'Add & Close',
        },
        {
          actionName: 'addChecklist',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a checklist item to next month's note",
          display: '<i class= "fa-regular fa-fw  fa-square-arrow-right sidebarMonthly" ></i> ',
          actionParam: nextPeriodFilename,
          formFields: nextMonthFormFields,
          submitOnEnter: true,
          submitButtonText: 'Add & Close',
        },
      ],
      isReferenced: false,
    }
    sections.push(section)

    // If we want this separated from the referenced items, then form a second section
    if (config.separateSectionForReferencedNotes) {
      let items: Array<TSectionItem> = []
      sectionNumStr = '9'
      if (useDemoData) {
        const sortedRefParas = refMonthParas
        // Note: parentID already supplied
        sortedRefParas.map((item) => {
          const thisID = `${sectionNumStr}-${itemCount}`
          items.push({ ID: thisID, ...item })
          itemCount++
        })
      } else {
        // Get list of open tasks/checklists from current monthly note (if it exists)
        if (sortedRefParas.length > 0) {
          // Iterate and write items for first (or combined) section
          items = createSectionOpenItemsFromParas(sortedRefParas, sectionNumStr)
          itemCount += items.length
        }
      }

      // Add separate section (if there are any items found)
      const section: TSection = {
        ID: sectionNumStr,
        name: '>This Month',
        showSettingName: 'showMonthSection',
        sectionCode: thisSectionCode,
        description: `{count} scheduled to ${dateStr}`,
        FAIconClass: 'fa-light fa-calendar-range',
        sectionTitleColorPart: 'sidebarMonthly',
        sectionFilename: thisFilename,
        sectionItems: items,
        generatedDate: new Date(),
        actionButtons: [],
        isReferenced: true,
      }
      sections.push(section)
    }

    logTimer('getDataForDashboard', startTime, `- found ${itemCount} monthly items from ${thisFilename}`)
    return sections
  } catch (error) {
    logError('getDataForDashboard/month', `ERROR: ${error.message}`)
    return []
  }
}

/**
 * Get open items from this Quarter's note
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @param {boolean} useEditorWherePossible?
 * @returns {TSection} data
 */
export function getThisQuarterSectionData(config: TDashboardSettings, useDemoData: boolean = false, useEditorWherePossible: boolean): Array<TSection> {
  try {
    let sectionNumStr = '10'
    const thisSectionCode = 'Q'
    const sections: Array<TSection> = []
    let items: Array<TSectionItem> = []
    let itemCount = 0
    const today = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone
    const dateStr = getNPQuarterStr(today)
    const NPSettings = getNotePlanSettings()
    const currentQuarterlyNote = DataStore.calendarNoteByDate(today, 'quarter')
    const thisFilename = `${dateStr}.${NPSettings.defaultFileExtension}`
    let sortedOrCombinedParas: Array<TParagraphForDashboard> = []
    let sortedRefParas: Array<TParagraphForDashboard> = []
    logDebug('getDataForDashboard', `---------- Gathering Quarter's ${useDemoData ? 'DEMO' : ''} items for section #${String(sectionNumStr)} ------------`)
    const startTime = new Date() // for timing only

    if (useDemoData) {
      // No demo data
    } else {
      if (currentQuarterlyNote) {
        const thisFilename = currentQuarterlyNote?.filename ?? '(error)'
        const dateStr = getDateStringFromCalendarFilename(thisFilename)
        if (!thisFilename.includes(dateStr)) {
          logError('getThisQuarterSectionData', `- filename '${thisFilename}' but '${dateStr}' ??`)
        }

        // Get list of open tasks/checklists from this calendar note
        ;[sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForTimePeriod('quarter', currentQuarterlyNote, config, useEditorWherePossible)

        // // write one combined section
        // sortedOrCombinedParas.map((p) => {
        //   const thisID = `${sectionNumStr}-${itemCount}`
        //   items.push(createSectionItemObject(thisID, p))
        //   itemCount++
        // })

        // Iterate and write items for first (or combined) section
        items = createSectionOpenItemsFromParas(sortedOrCombinedParas, sectionNumStr)
        itemCount += items.length

        // logDebug('getDataForDashboard', `- finished finding Quarterly items from ${dateStr} after ${timer(startTime)}`)
      } else {
        logDebug('getDataForDashboard', `No Quarterly note found for filename '${thisFilename}'`)
      }
    }
    const nextPeriodNote = DataStore.calendarNoteByDate(new moment().add(1, 'quarter').toDate(), 'quarter')
    const nextPeriodFilename = nextPeriodNote?.filename ?? ''
    const doneCountData = getNumCompletedTasksTodayFromNote(thisFilename, true)

    // Set up formFields for the 'add buttons' (applied in Section.jsx)
    const formFieldsBase: Array<TSettingItem> = [{ type: 'input', label: 'Task:', key: 'text', focus: true }]
    const thisQuarterHeadings: Array<string> = currentQuarterlyNote ? getHeadingsFromNote(currentQuarterlyNote, false, true, true, true) : []
    const nextQuarterHeadings: Array<string> = nextPeriodNote ? getHeadingsFromNote(nextPeriodNote, false, true, true, true) : []
    // Set the default heading to add to, unless it's '<<carry forward>>', in which case we'll use an empty string
    const defaultHeadingToAddTo: string = config.newTaskSectionHeading !== '<<carry forward>>' ? config.newTaskSectionHeading : ''
    const thisQuarterFormFields: Array<TSettingItem> = formFieldsBase.concat(
      thisQuarterHeadings.length
        ? // $FlowIgnore[incompatible-type]
          [
            {
              type: 'dropdown-select',
              label: 'Under Heading:',
              key: 'heading',
              // $FlowFixMe[incompatible-type]
              options: thisQuarterHeadings,
              noWrapOptions: true,
              value: defaultHeadingToAddTo,
            },
          ]
        : [],
    )
    const nextQuarterFormFields: Array<TSettingItem> = formFieldsBase.concat(
      nextQuarterHeadings.length
        ? // $FlowIgnore[incompatible-type]
          [
            {
              type: 'dropdown-select',
              label: 'Under Heading:',
              key: 'heading',
              // $FlowFixMe[incompatible-type]
              options: nextQuarterHeadings,
              noWrapOptions: true,
              value: defaultHeadingToAddTo,
            },
          ]
        : [],
    )

    const section: TSection = {
      ID: sectionNumStr,
      name: 'This Quarter',
      showSettingName: 'showQuarterSection',
      sectionCode: thisSectionCode,
      description: `{count} from ${dateStr}`,
      FAIconClass: 'fa-light fa-calendar-days',
      sectionTitleColorPart: 'sidebarQuarterly',
      sectionFilename: thisFilename,
      sectionItems: items,
      generatedDate: new Date(),
      doneCounts: doneCountData,
      actionButtons: [
        {
          actionName: 'addTask',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a new task to this quarter's note",
          display: '<i class= "fa-regular fa-fw  fa-circle-plus sidebarQuarterly" ></i> ',
          actionParam: thisFilename,
          postActionRefresh: ['Q'],
          formFields: thisQuarterFormFields,
          submitOnEnter: true,
          submitButtonText: 'Add & Close',
        },
        {
          actionName: 'addChecklist',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a checklist item to this quarter's note",
          display: '<i class= "fa-regular fa-fw  fa-square-plus sidebarQuarterly" ></i> ',
          actionParam: thisFilename,
          postActionRefresh: ['Q'],
          formFields: thisQuarterFormFields,
          submitOnEnter: true,
          submitButtonText: 'Add & Close',
        },
        {
          actionName: 'addTask',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a new task to next quarter's note",
          display: '<i class= "fa-regular fa-fw  fa-circle-arrow-right sidebarQuarterly" ></i> ',
          actionParam: nextPeriodFilename,
          formFields: nextQuarterFormFields,
          submitOnEnter: true,
          submitButtonText: 'Add & Close',
        },
        {
          actionName: 'addChecklist',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a checklist item to next quarter's note",
          display: '<i class= "fa-regular fa-fw  fa-square-arrow-right sidebarQuarterly" ></i> ',
          actionParam: nextPeriodFilename,
          formFields: nextQuarterFormFields,
          submitOnEnter: true,
          submitButtonText: 'Add & Close',
        },
      ],
      isReferenced: false,
    }
    sections.push(section)

    // If we want this separated from the referenced items, then form a second section
    if (config.separateSectionForReferencedNotes) {
      let items: Array<TSectionItem> = []
      sectionNumStr = '11'
      if (useDemoData) {
        // No demo data
      } else {
        // Get list of open tasks/checklists from current quarterly note (if it exists)
        if (sortedRefParas.length > 0) {
          // Iterate and write items for this section
          items = createSectionOpenItemsFromParas(sortedRefParas, sectionNumStr)
          itemCount += items.length
        }
      }

      // Add separate section (if there are any items found)
      const section: TSection = {
        ID: sectionNumStr,
        name: '>This Quarter',
        showSettingName: 'showQuarterSection',
        sectionCode: thisSectionCode,
        description: `{count} scheduled to ${dateStr}`,
        FAIconClass: 'fa-light fa-calendar-days',
        sectionTitleColorPart: 'sidebarQuarterly',
        sectionFilename: thisFilename,
        sectionItems: items,
        generatedDate: new Date(),
        actionButtons: [],
        isReferenced: true,
      }
      sections.push(section)
    }

    logDebug('getDataForDashboard', `- found ${itemCount} quarterly items from ${dateStr} in ${timer(startTime)}`)
    return sections
  } catch (error) {
    logError('getDataForDashboard/quarter', `ERROR: ${error.message}`)
    return []
  }
}

//----------------------------------------------------------------
// Note: If we want to do yearly in the future then the icon is
//   fa-calendar-days (same as quarter). This would be section #6
//----------------------------------------------------------------

/**
 * Note: now not used, as core of it is now in getSomeSectionsData() above. This is because:
 *  1. it is really just a wrapper around getTaggedSectionData()
 *  2. this means multiple TAG sections can be returned as they are generated, rather than all at once, which feels more natural.
 * Get the tagged sections for each tag - they will all be sectionCode=TAG
 * sectionName will be the tag name, and showSettingName will be unique for this tag
 * @param {TDashboardSettings} config
 * @param {boolean} [useDemoData=false]
 * @returns {Array<TSection>}
 */
// export function getTaggedSections(config: TDashboardSettings, useDemoData: boolean = false): Array<TSection> {
//   const startTime = new Date()
//   const tagSections = getTagSectionDetails(removeInvalidTagSections(config))
//   // clo(tagSections)
//   // logInfo('getTaggedSections', `- after getTagSectionDetails:  ${timer(startTime)}`)
//
//   const output = tagSections.reduce((acc: Array<TSection>, sectionDetail: TSectionDetails, index: number) => {
//     // $FlowIgnore[invalid-computed-prop]
//     const showSettingForTag = config[sectionDetail.showSettingName]
//     // logDebug('getTaggedSections', `sectionDetail.sectionName=${sectionDetail.sectionName} showSettingForTag=${showSettingForTag}`)
//     if (typeof showSettingForTag === 'undefined' || showSettingForTag) acc.push(getTaggedSectionData(config, useDemoData, sectionDetail, index))
//     return acc // Return the accumulator
//   }, [])
//   logTimer('getTaggedSections', startTime, `at end`, 1500)
//   return output
// }

/**
 * Generate data for a section for items with a Tag/Mention.
 * Only find paras with this *single* tag/mention which include open tasks that aren't scheduled in the future.
 * Now also uses all the 'ignore' settings, other than any that are the same as this particular tag/mention.
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 */
export async function getTaggedSectionData(config: TDashboardSettings, useDemoData: boolean = false, sectionDetail: TSectionDetails, index: number): Promise<TSection> {
  const thisStartTime = new Date()
  const sectionNumStr = `12-${index}`
  const thisSectionCode = 'TAG'
  logInfo('getTaggedSectionData', `------- Gathering Tag items for section #${String(sectionNumStr)}: ${sectionDetail.sectionName} --------`)
  // if (config.ignoreChecklistItems) logDebug('getTaggedSectionData', `Note: will filter out checklists`)
  let itemCount = 0
  let totalCount = 0
  const items: Array<TSectionItem> = []
  let isHashtag = false
  let isMention = false
  // const thisStartTime = new Date()

  const ignoreTermsMinusTagCSV: string = stringListOrArrayToArray(config.ignoreItemsWithTerms, ',')
    .filter((t) => t !== sectionDetail.sectionName)
    .join(',')
  logInfo('getTaggedSectionData', `ignoreTermsMinusTag: ${ignoreTermsMinusTagCSV}  (was: ${config.ignoreItemsWithTerms})`)

  if (useDemoData) {
    isHashtag = true
    tagParasFromNote.map((item) => {
      const thisID = `${sectionNumStr}-${itemCount}`
      items.push({ ID: thisID, ...item })
      itemCount++
    })
  } else {
    isHashtag = sectionDetail.sectionName.startsWith('#')
    isMention = sectionDetail.sectionName.startsWith('@')
    if (isHashtag || isMention) {
      let filteredTagParas: Array<TParagraph> = []

      // Get notes with matching hashtag or mention (as can't get list of paras directly)
      let cacheLookupTime = 0
      const notesWithTagFromCache: Array<TNote> = []
      if (config?.FFlag_UseTagCache) {
        logDebug('getTaggedSectionData', `(FFlag_UseTagCache) - Using tag cache for ${sectionDetail.sectionName}`)
        const cachedOperationStartTime = new Date()
        const filenamesWithTagFromCache = await getNotesWithTagOrMention([sectionDetail.sectionName], true)
        filenamesWithTagFromCache.forEach((filename) => {
          const note = getNoteByFilename(filename)
          if (note) notesWithTagFromCache.push(note)
        })
        logInfo('getTaggedSectionData', `- found ${notesWithTagFromCache.length} notes with ${sectionDetail.sectionName} FROM CACHE in ${timer(cachedOperationStartTime)}`)
        // $FlowIgnore[unsafe-arithmetic]
        cacheLookupTime = new Date() - cachedOperationStartTime
      }
      // Note: this is slow (about 1ms per note, so 3100ms for 3250 notes).
      // Though JGC has also seen 9,900ms for all notes in the system, so its variable.
      const thisStartTime = new Date()
      const notesWithTag = findNotesMatchingHashtagOrMention(sectionDetail.sectionName, true, true, true)
      // $FlowIgnore[unsafe-arithmetic]
      const APILookupTime = new Date() - thisStartTime
      logInfo('getTaggedSectionData', `- found ${notesWithTag.length} notes with ${sectionDetail.sectionName} from API in ${timer(thisStartTime)}`)

      if (config?.FFlag_UseTagCache) {
        // Log timing details and comparison
        logDebug('getTaggedSectionData', `- CACHE operation took ${percent(cacheLookupTime, APILookupTime)}`)
        // Compare the two lists and warn if different
        if (notesWithTagFromCache.length !== notesWithTag.length) {
          logError('getTaggedSectionData', `- notesWithTagFromCache.length !== notesWithTag.length.`)
          // Write a list of filenames that are in one but not the other
          const filenamesInCache = notesWithTagFromCache.map((n) => n.filename)
          const filenamesInAPI = notesWithTag.map((n) => n.filename)
          // const filenamesInBoth = filenamesInCache.filter((f) => filenamesInAPI.includes(f))
          logError('getTaggedSectionData', `- filenames in cache but not in API: ${filenamesInCache.filter((f) => !filenamesInAPI.includes(f)).join(', ')}`)
          logError('getTaggedSectionData', `- filenames in API but not in cache: ${filenamesInAPI.filter((f) => !filenamesInCache.includes(f)).join(', ')}`)
        }
      }

      for (const n of notesWithTag) {
        // const startTime2 = new Date()
        // Don't continue if this note is in an excluded folder
        const thisNoteFolder = getFolderFromFilename(n.filename)
        if (stringListOrArrayToArray(config.excludedFolders, ',').includes(thisNoteFolder)) {
          // logDebug('getTaggedSectionData', `- ignoring note '${n.filename}' as it is in an ignored folder`)
          continue
        }

        // Get the relevant paras from this note
        const paras = n.paragraphs ?? []
        if (paras.length > 500) {
          // const startTime3 = new Date()
          // logTimer('getTaggedSectionData', startTime3, `- found ${paras.length} paras in "${n.filename}"`)
          const content = n.content ?? ''
          // logTimer('getTaggedSectionData', startTime3, `- to pull content from note`)
          const pp = content.split('\n')
          // logTimer('getTaggedSectionData', startTime3, `- to split content into ${pp.length} lines`)
        }
        // Next operation typically takes 1ms
        const tagParasFromNote = paras.filter((p) => p.content?.includes(sectionDetail.sectionName))
        // logTimer('getTaggedSectionData', startTime2, `- found ${tagParasFromNote.length} paras containing ${sectionDetail.sectionName} in "${n.filename}"`)

        // Further filter out checklists and otherwise empty items
        const filteredTagParasFromNote = config.ignoreChecklistItems
          ? tagParasFromNote.filter((p) => isOpenTask(p) && p.content.trim() !== '')
          : tagParasFromNote.filter((p) => isOpen(p) && p.content.trim() !== '')

        // Save this para, unless in matches the 'ignoreItemsWithTerms' setting (now modified to exclude this tag/mention)
        for (const p of filteredTagParasFromNote) {
          if (!isLineDisallowedByExcludedTerms(p.content, ignoreTermsMinusTagCSV)) {
            filteredTagParas.push(p)
          } else {
            // logDebug('getTaggedSectionData', `- ignoring para {${p.content}}`)
          }
        }
        // logTimer('getTaggedSectionData', thisStartTime, `- "${n.title || ''}" after filtering out: ${config.ignoreItemsWithTerms}, ${filteredTagParas.length} paras`)
      }
      logTimer('getTaggedSectionData', thisStartTime, `- ${filteredTagParas.length} paras after filtering ${notesWithTag.length} notes`)

      // filter out paras in the future
      const dateToUseUnhyphenated = config.showTomorrowSection ? new moment().add(1, 'days').format('YYYYMMDD') : new moment().format('YYYYMMDD')
      filteredTagParas = filteredTagParas.filter((p) => !filenameIsInFuture(p.filename || '', dateToUseUnhyphenated))
      const dateToUseHyphenated = config.showTomorrowSection ? new moment().add(1, 'days').format('YYYY-MM-DD') : new moment().format('YYYY-MM-DD')
      // Next operation typically takes 1ms
      filteredTagParas = filteredTagParas.filter((p) => !includesScheduledFutureDate(p.content, dateToUseHyphenated))
      logTimer('getTaggedSectionData', thisStartTime, `- after filtering for future, ${filteredTagParas.length} paras`)

      if (filteredTagParas.length > 0) {
        // Remove possible dupes from these sync'd lines. Note: this is a quick operation, as we aren't using the 'most recent' option (which does a sort)
        filteredTagParas = eliminateDuplicateSyncedParagraphs(filteredTagParas)
        logTimer('getTaggedSectionData', thisStartTime, `- after sync dedupe -> ${filteredTagParas.length}`)
        // Remove items that appear in this section twice (which can happen if a task is in a calendar note and scheduled to that same date)
        // Note: this is a quick operation
        // $FlowIgnore[class-object-subtyping]
        filteredTagParas = removeDuplicates(filteredTagParas, ['content', 'filename'])
        logTimer('getTaggedSectionData', thisStartTime, `- after removeDuplicates -> ${filteredTagParas.length}`)

        // Create a much cut-down version of this array that just leaves the content, priority, but also the note's title, filename and changedDate.
        // Note: this is a pretty quick operation (3-4ms / item)
        // $FlowIgnore[class-object-subtyping]
        const dashboardParas = makeDashboardParas(filteredTagParas)
        logTimer('getTaggedSectionData', thisStartTime, `- after eliminating dupes -> ${dashboardParas.length}`)

        totalCount = dashboardParas.length

        // Sort paragraphs by one of several options
        const sortOrder =
          config.overdueSortOrder === 'priority'
            ? ['-priority', '-changedDate']
            : config.overdueSortOrder === 'earliest'
            ? ['changedDate', 'priority']
            : ['-changedDate', 'priority'] // 'most recent'
        const sortedTagParas = sortListBy(dashboardParas, sortOrder)
        logTimer('getTaggedSectionData', thisStartTime, `- Filtered, Reduced & Sorted  ${sortedTagParas.length} items by ${String(sortOrder)}`)

        for (const p of sortedTagParas) {
          const thisID = `${sectionNumStr}.${itemCount}`
          // $FlowIgnore[incompatible-call]
          items.push(createSectionItemObject(thisID, p))
          itemCount++
        }
      } else {
        logDebug('getTaggedSectionData', `- no items to show for ${sectionDetail.sectionName}`)
      }
    }
  }

  // Return section details, even if no items found
  const tagSectionDescription = `{count} item{s} ordered by ${config.overdueSortOrder}${config?.FFlag_UseTagCache ? ', using tag cache' : ''}` // TODO(later): remove note about the tag cache
  const section: TSection = {
    ID: sectionNumStr,
    name: sectionDetail.sectionName,
    showSettingName: sectionDetail.showSettingName,
    sectionCode: thisSectionCode,
    description: tagSectionDescription,
    FAIconClass: isHashtag ? 'fa-light fa-hashtag' : 'fa-light fa-at',
    sectionTitleColorPart: isHashtag ? 'sidebarHashtag' : 'sidebarMention',
    sectionFilename: '',
    sectionItems: items,
    totalCount: totalCount, // Note: Now not sure how this is used (if it is)
    generatedDate: new Date(),
    isReferenced: false,
    actionButtons: [],
  }
  logTimer('getTaggedSectionData', thisStartTime, `to find ${itemCount} ${sectionDetail.sectionName} items`, 1000)
  return section
}

// ----------------------------------------------------------
/**
 * Generate data for a section for Overdue tasks
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 */
export async function getOverdueSectionData(config: TDashboardSettings, useDemoData: boolean = false): Promise<TSection> {
  try {
    const sectionNumStr = '13'
    const thisSectionCode = 'OVERDUE'
    let totalOverdue = 0
    let itemCount = 0
    let overdueParas: Array<any> = [] // can't be typed to TParagraph as the useDemoData code writes to what would be read-only properties
    let dashboardParas: Array<TParagraphForDashboard> = []
    const maxInSection = config.maxItemsToShowInSection
    const NPSettings = getNotePlanSettings()
    const thisStartTime = new Date()

    logInfo('getOverdueSectionData', `------- Gathering Overdue Tasks for section #${String(sectionNumStr)} -------`)
    if (useDemoData) {
      // Note: to make the same processing as the real data (later), this is done only in terms of extended paras
      for (let c = 0; c < 60; c++) {
        // const thisID = `${sectionNumStr}-${String(c)}`
        const thisType = c % 3 === 0 ? 'checklist' : 'open'
        const priorityPrefix = c % 20 === 0 ? '!!! ' : c % 10 === 0 ? '!! ' : c % 5 === 0 ? '! ' : ''
        const fakeDateMom = new moment('2023-10-01').add(c, 'days')
        const fakeIsoDateStr = fakeDateMom.format('YYYY-MM-DD')
        const fakeFilenameDateStr = fakeDateMom.format('YYYYMMDD')
        const filename = c % 3 < 2 ? `${fakeFilenameDateStr}.${NPSettings.defaultFileExtension}` : `fake_note_${String(c % 7)}.${NPSettings.defaultFileExtension}`
        const type = c % 3 < 2 ? 'Calendar' : 'Notes'
        const content = `${priorityPrefix}test overdue item ${c} >${fakeIsoDateStr}`
        overdueParas.push({
          filename: filename,
          content: content,
          rawContent: `${thisType === 'open' ? '*' : '+'} ${priorityPrefix}${content}`,
          type: thisType,
          note: {
            filename: filename,
            title: `Overdue Test Note ${c % 10}`,
            type: type,
            changedDate: fakeDateMom.toDate(),
          },
        })
      }
    } else {
      // Get overdue tasks
      // Note: Cannot move the reduce into here otherwise scheduleAllOverdueOpenToToday() doesn't have all it needs to work
      // overdueParas = await getRelevantOverdueTasks(config, yesterdaysCombinedSortedParas)
      overdueParas = await getRelevantOverdueTasks(config, [])
      logDebug('getOverdueSectionData', `- found ${overdueParas.length} overdue paras in ${timer(thisStartTime)}`)
    }

    const items: Array<TSectionItem> = []

    if (overdueParas.length > 0) {
      // Create a much cut-down version of this array that just leaves a few key fields, plus filename, priority
      // Note: this takes ~600ms for 1,000 items
      dashboardParas = makeDashboardParas(overdueParas)
      logDebug('getOverdueSectionData', `- after reducing paras -> ${dashboardParas.length} in ${timer(thisStartTime)}`)

      // Remove possible dupes from sync'd lines
      // TODO(@dwertheimer): please test whether we can re-introduce this?
      // Note: currently commented out, to save 2? secs of processing
      // overdueParas = eliminateDuplicateSyncedParagraphs(overdueParas)
      // logTimer('getOverdueSectionData', thisStartTime, `- after sync lines dedupe ->  ${overdueParas.length}`)

      totalOverdue = dashboardParas.length

      // Sort paragraphs by one of several options
      const sortOrder =
        config.overdueSortOrder === 'priority' ? ['-priority', '-changedDate'] : config.overdueSortOrder === 'earliest' ? ['changedDate', 'priority'] : ['-changedDate', 'priority'] // 'most recent'
      const sortedOverdueTaskParas = sortListBy(dashboardParas, sortOrder)
      logDebug('getOverdueSectionData', `- Sorted ${sortedOverdueTaskParas.length} items by ${String(sortOrder)} after ${timer(thisStartTime)}`)

      // Apply limit to set of ordered results
      // Note: there is also filtering in the Section component
      // Note: this doesn't attempt to calculate parentIDs. TODO: Should it?
      const overdueTaskParasLimited = totalOverdue > maxInSection ? sortedOverdueTaskParas.slice(0, maxInSection) : sortedOverdueTaskParas
      logDebug('getOverdueSectionData', `- after limit, now ${overdueTaskParasLimited.length} items to show`)
      overdueTaskParasLimited.map((p) => {
        const thisID = `${sectionNumStr}-${itemCount}`
        items.push(createSectionItemObject(thisID, p))
        itemCount++
      })
    }
    logDebug('getOverdueSectionData', `- finished finding overdue items after ${timer(thisStartTime)}`)

    const overdueSectionDescription =
      totalOverdue > itemCount
        ? `first {count} of {totalCount} ${config.lookBackDaysForOverdue > 0 ? `from last ${String(config.lookBackDaysForOverdue)} days ` : ''}ordered by ${
            config.overdueSortOrder
          }`
        : `{count} ordered by ${config.overdueSortOrder}`

    const section: TSection = {
      ID: sectionNumStr,
      name: 'Overdue Tasks',
      showSettingName: 'showOverdueSection',
      sectionCode: thisSectionCode,
      description: overdueSectionDescription,
      FAIconClass: 'fa-regular fa-alarm-exclamation',
      // no sectionTitleColorPart, so will use default
      sectionFilename: '',
      sectionItems: items,
      generatedDate: new Date(),
      totalCount: totalOverdue,
      isReferenced: false,
      actionButtons: [
        {
          actionName: 'scheduleAllOverdueToday',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: 'Schedule all Overdue tasks to Today',
          display: 'All Overdue <i class="fa-solid fa-right-long"></i> Today',
          actionParam: '',
          postActionRefresh: ['OVERDUE'],
        },
      ],
    }
    // console.log(JSON.stringify(section))
    logTimer('getOverdueSectionData', thisStartTime, `found ${itemCount} items for ${thisSectionCode}`, 1000)
    return section
  } catch (error) {
    logError(pluginJson, JSP(error))
    // $FlowFixMe[incompatible-return]
    return null
  }
}

// ----------------------------------------------------------
/**
 * Generate data for a section of raised Priority tasks
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 */
export async function getPrioritySectionData(config: TDashboardSettings, useDemoData: boolean = false): Promise<TSection> {
  try {
    const sectionNumStr = '14'
    const thisSectionCode = 'PRIORITY'
    let totalPriority = 0
    let itemCount = 0
    let priorityParas: Array<any> = [] // can't be typed to TParagraph as the useDemoData code writes to what would be read-only properties
    let dashboardParas: Array<TParagraphForDashboard> = []
    const maxInSection = config.maxItemsToShowInSection
    const NPSettings = getNotePlanSettings()
    const thisStartTime = new Date()

    logInfo('getPrioritySectionData', `------- Gathering Priority Tasks for section #${String(sectionNumStr)} -------`)
    if (useDemoData) {
      // Note: to make the same processing as the real data (later), this is done only in terms of extended paras
      for (let c = 0; c < 60; c++) {
        // const thisID = `${sectionNumStr}-${String(c)}`
        const thisType = c % 3 === 0 ? 'checklist' : 'open'
        const priorityPrefix = c % 20 === 0 ? '>> ' : c % 10 === 0 ? '!!! ' : c % 5 === 0 ? '!! ' : '! '
        const fakeDateMom = new moment('2023-10-01').add(c, 'days')
        const fakeIsoDateStr = fakeDateMom.format('YYYY-MM-DD')
        const fakeFilenameDateStr = fakeDateMom.format('YYYYMMDD')
        const filename = c % 3 < 2 ? `${fakeFilenameDateStr}.${NPSettings.defaultFileExtension}` : `fake_note_${String(c % 7)}.${NPSettings.defaultFileExtension}`
        const type = c % 3 < 2 ? 'Calendar' : 'Notes'
        const content = `${priorityPrefix}test priority item ${c} >${fakeIsoDateStr}`
        priorityParas.push({
          filename: filename,
          content: content,
          rawContent: `${thisType === 'open' ? '*' : '+'} ${priorityPrefix}${content}`,
          type: thisType,
          note: {
            filename: filename,
            title: `Priority Test Note ${c % 10}`,
            type: type,
            changedDate: fakeDateMom.toDate(),
          },
        })
      }
    } else {
      // Get priority tasks
      // Note: Cannot move the reduce into here otherwise scheduleAllPriorityOpenToToday() doesn't have all it needs to work
      priorityParas = await getRelevantPriorityTasks(config)
      logDebug('getPrioritySectionData', `- found ${priorityParas.length} priority paras in ${timer(thisStartTime)}`)
    }

    const items: Array<TSectionItem> = []

    if (priorityParas.length > 0) {
      // Create a much cut-down version of this array that just leaves a few key fields, plus filename, priority
      // Note: this takes ~600ms for 1,000 items
      dashboardParas = makeDashboardParas(priorityParas)
      logDebug('getPrioritySectionData', `- after reducing paras -> ${dashboardParas.length} in ${timer(thisStartTime)}`)

      // TODO(later): Remove possible dupes from sync'd lines
      // priorityParas = eliminateDuplicateSyncedParagraphs(priorityParas)
      // logTimer('getPrioritySectionData', thisStartTime, `- after sync lines dedupe -> ${priorityParas.length}`)

      totalPriority = dashboardParas.length

      // Sort paragraphs by priority
      const sortOrder = ['-priority', '-changedDate']
      const sortedPriorityTaskParas = sortListBy(dashboardParas, sortOrder)
      logTimer('getPrioritySectionData', thisStartTime, `- Sorted ${sortedPriorityTaskParas.length} items`)

      // Apply limit to set of ordered results
      // Note: there is also filtering in the Section component
      // Note: this doesn't attempt to calculate parentIDs. TODO: Should it?
      const priorityTaskParasLimited = totalPriority > maxInSection ? sortedPriorityTaskParas.slice(0, maxInSection) : sortedPriorityTaskParas
      logDebug('getPrioritySectionData', `- after limit, now ${priorityTaskParasLimited.length} items to show`)
      priorityTaskParasLimited.map((p) => {
        const thisID = `${sectionNumStr}-${itemCount}`
        items.push(createSectionItemObject(thisID, p))
        itemCount++
      })
    }
    logTimer('getPrioritySectionData', thisStartTime, `- finished finding priority items`)

    const prioritySectionDescription = totalPriority > itemCount ? `{count} of {totalCount}` : `{count}`

    const section: TSection = {
      ID: sectionNumStr,
      name: 'Priority Tasks',
      showSettingName: 'showPrioritySection',
      sectionCode: thisSectionCode,
      description: prioritySectionDescription,
      FAIconClass: 'fa-regular fa-angles-up',
      // FAIconClass: 'fa-light fa-star-exclamation',
      // no sectionTitleColorPart, so will use default
      sectionFilename: '',
      sectionItems: items,
      generatedDate: new Date(),
      totalCount: totalPriority,
      isReferenced: false,
      actionButtons: [],
    }
    logTimer('getPrioritySectionData', thisStartTime, `found ${itemCount} items for ${thisSectionCode}`, 1500)
    return section
  } catch (error) {
    logError(pluginJson, JSP(error))
    // $FlowFixMe[incompatible-return]
    return null
  }
}

/**
 * Finds all items within the provided sections that match the given field/value pairs.
 *
 * @param {Array<TSection>} sections - An array of section objects containing sectionItems.
 * @param {Array<string>} fieldPathsToMatch - An array of field paths (e.g., 'para.filename', 'itemType') to match against.
 * @param {Object<string, string|RegExp>} fieldValues - An object containing the field values to match against. Values can be strings or regular expressions.
 * @returns {Array<SectionItemIndex>} An array of objects containing the section index and item index for each matching item.
 * @example const indexes = findSectionItems(sections, ['itemType', 'filename', 'para.content'], { itemType: /open|checklist/, filename: oldFilename, 'para.content': oldContent }) // find all references to this content (could be in multiple sections)

 * @author @dwertheimer
 */
export function findSectionItems(
  sections: Array<TSection>,
  fieldPathsToMatch: Array<string>,
  fieldValues: { [key: string]: string | RegExp },
): Array<{ sectionIndex: number, itemIndex: number }> {
  const matches: Array<{ sectionIndex: number, itemIndex: number }> = []

  sections.forEach((section, sectionIndex) => {
    section.sectionItems.forEach((item, itemIndex) => {
      const isMatch = fieldPathsToMatch.every((fieldPath) => {
        const itemFieldValue = getNestedValue(item, fieldPath)
        if (!itemFieldValue) {
          logDebug(`findSectionItems: ${fieldPath} is undefined in ${JSP(item)} -- may be ok if you are looking for a task and this is a review item`)
          return false
        }
        const fieldValue = fieldValues[fieldPath]
        if (fieldValue instanceof RegExp) {
          return fieldValue.test(itemFieldValue)
        } else {
          // logDebug(
          //   `findSectionItems:`,
          //   `${item.ID} itemFieldValue: ${itemFieldValue} ${
          //     itemFieldValue ? (itemFieldValue === fieldValue ? 'equals' : 'does not equal') : 'is undefined'
          //   } fieldValue: ${fieldValue}`,
          // )
          return itemFieldValue ? itemFieldValue === fieldValue : false
        }
      })

      if (isMatch) {
        matches.push({ sectionIndex, itemIndex })
      }
    })
  })

  return matches
}

/**
 * Copies specified fields from a provided object into the corresponding sectionItems in the sections array.
 *
 * @param {Array<SectionItemIndex>} results - An array of results from the findSectionItems function, containing section and item indices.
 * @param {Array<string>} fieldPathsToReplace - An array of field paths (maybe nested) within TSectionItem (e.g. 'itemType', 'para.filename') to copy from the provided object.
 * @param {Object} updatedValues - The object containing the field values to be copied -- the keys are the field paths (can be strings with dots, e.g. para.filename) and the values are the values to copy.
 * @param {Array<TSection>} sections - The original sections array to be modified.
 * @returns {Array<TSection>} The modified sections array with the specified fields copied into the corresponding sectionItems.
 */
export function copyUpdatedSectionItemData(
  results: Array<{ sectionIndex: number, itemIndex: number }>,
  fieldPathsToReplace: Array<string>,
  updatedValues: { [key: string]: any },
  sections: Array<TSection>,
): Array<TSection> {
  results.forEach(({ sectionIndex, itemIndex }) => {
    const sectionItem = sections[sectionIndex].sectionItems[itemIndex]

    fieldPathsToReplace.forEach((fieldPath) => {
      // const [firstField, ...remainingPath] = fieldPath.split('.')
      const value = getNestedValue(updatedValues, fieldPath)
      if (value !== undefined) {
        setNestedValue(sectionItem, fieldPath, value)
      }
    })
    sectionItem.updated = true
  })

  return sections
}

/**
 * Helper function to get the value of a nested field in an object.
 *
 * @param {Object} obj - The object to search for the nested field.
 * @param {string} path - The path to the nested field, e.g., 'para.filename'.
 * @returns {any} The value of the nested field, or undefined if the field doesn't exist.
 */
function getNestedValue(obj: any, path: string) {
  const fields = path.split('.')
  let value = obj

  for (const field of fields) {
    if (value && typeof value === 'object' && field in value) {
      value = value[field]
    } else {
      return undefined
    }
  }

  return value
}

/**
 * Helper function to set the value of a nested field in an object.
 *
 * @param {Object} obj - The object to set the nested field value in.
 * @param {string} path - The path to the nested field, e.g., 'para.filename'.
 * @param {any} value - The value to set for the nested field.
 */
function setNestedValue(obj: any, path: string, value: any) {
  const fields = path.split('.')
  let currentObj = obj

  for (let i = 0; i < fields.length - 1; i++) {
    const field = fields[i]
    if (!currentObj.hasOwnProperty(field)) {
      currentObj[field] = {}
    }
    currentObj = currentObj[field]
  }
  const finalField = fields[fields.length - 1]
  currentObj[finalField] = value
}
