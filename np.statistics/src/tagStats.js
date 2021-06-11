// @flow

import { todaysDateISOString } from './statsHelpers'

//-----------------------------------------------------------------------------
// User settings: TODO: move to proper preferences system, when available in NP
const pref_folderToStore = 'Summaries'
const pref_countsHeading = 'Hashtag counts'
const pref_countsHeadingLevel = 3
const pref_showAsHashtag = false

//-----------------------------------------------------------------------------
// Helper functions
import {
  chooseOption,
  // monthsAbbrev,
  // todaysDateISOString,
  // getYearMonthDate,
  monthNameAbbrev,
  withinDateRange,
  dateStringFromCalendarFilename,
  // unhyphenateDateString,
  // hyphenatedDateString,
  // filenameDateString,
} from './statsHelpers'

//-------------------------------------------------------------------------------
// Ask user which period to cover, call main stats function, and present results
export default async function tagStats() {
  const todaysDate = new Date()
  // couldn't get const { y, m, d } = getYearMonthDate(todaysDate) to work ??
  const y = todaysDate.getFullYear()
  const m = todaysDate.getMonth() + 1
  const d = todaysDate.getDate()

  // Ask user what time interval to do tag counts for
  const period = await chooseOption(
    'Which date interval would you like me to count hashtags for?',
    [
      {
        label: 'Last Month',
        value: 'lm',
      },
      {
        label: 'This Month (to date)',
        value: 'mtd',
      },
      {
        label: 'Last Quarter',
        value: 'lq',
      },
      {
        label: 'This Quarter (to date)',
        value: 'qtd',
      },
      {
        label: 'Last Year',
        value: 'ly',
      },
      {
        label: 'Year to date',
        value: 'ytd',
      },
    ],
    'mtd',
  )

  let fromDate
  let toDate
  let periodString = ''
  let countsHeading = ''

  switch (period) {
    case 'lm': {
      fromDate = Calendar.dateFrom(y, m, 1, 0, 0, 0) // go to start of this month
      fromDate = Calendar.addUnitToDate(fromDate, 'month', -1) // -1 month
      toDate = Calendar.addUnitToDate(fromDate, 'month', 1) // + 1 month
      toDate = Calendar.addUnitToDate(toDate, 'day', -1) // -1 day, to get last day of last month
      periodString = `${monthNameAbbrev(fromDate.getMonth() + 1)} ${y}`
      countsHeading = pref_countsHeading
      break
    }
    case 'mtd': {
      fromDate = Calendar.dateFrom(y, m, 1, 0, 0, 0) // start of this month
      toDate = Calendar.dateFrom(y, m, d, 0, 0, 0)
      periodString = `${monthNameAbbrev(m)} ${y}`
      countsHeading = `${pref_countsHeading} (to ${todaysDateISOString})`
      break
    }
    case 'lq': {
      const thisQ = Math.floor((m - 1) / 3) + 1
      const lastQ = (thisQ > 0) ? thisQ - 1 : 4
      const thisQStartMonth = (thisQ-1) * 3 + 1
      const lastQStartMonth = (lastQ-1) * 3 + 1
      fromDate = Calendar.dateFrom(y, thisQStartMonth, 1, 0, 0, 0) // start of this quarter
      fromDate = Calendar.addUnitToDate(fromDate, 'month', -3) // -1 quarter
      toDate = Calendar.addUnitToDate(fromDate, 'month', 3) // +1 quarter
      toDate = Calendar.addUnitToDate(toDate, 'day', -1) // -1 day, to get last day of last month
      periodString = `Q${lastQ} (${monthNameAbbrev(lastQStartMonth)}-${monthNameAbbrev(lastQStartMonth + 3)}) ${y}`
      countsHeading = pref_countsHeading
      break
    }
    case 'qtd': {
      const thisQ = Math.floor((m - 1) / 3) + 1
      const thisQStartMonth = (thisQ-1) * 3 + 1
      fromDate = Calendar.dateFrom(y, thisQStartMonth, 1, 0, 0, 0) // start of this quarter
      toDate = Calendar.dateFrom(y, m, d, 0, 0, 0)
      periodString = `Q${thisQ} (${monthNameAbbrev(thisQStartMonth)}-${monthNameAbbrev(thisQStartMonth + 3)}) ${y}`
      countsHeading = `${pref_countsHeading} (to ${todaysDateISOString})`
      break
    }
    case 'ly': {
      fromDate = Calendar.dateFrom(y - 1, 1, 1, 0, 0, 0) // start of last year
      toDate = Calendar.dateFrom(y - 1, 12, 31, 0, 0, 0) // end of last year
      periodString = `${y - 1}`
      countsHeading = pref_countsHeading
      break
    }
    case 'ytd': {
      fromDate = Calendar.dateFrom(y, 1, 1, 0, 0, 0) // start of this year
      toDate = Calendar.dateFrom(y, m, d, 0, 0, 0)
      periodString = `${y}`
      countsHeading = `${pref_countsHeading} (to ${todaysDateISOString})`
      break
    }
  }
  if (fromDate == null || toDate == null) {
    console.log('dates could not be parsed')
    return
  }
  const fromDateStr = fromDate.toISOString().slice(0, 10).replace(/-/g, '')
  const toDateStr = toDate.toISOString().slice(0, 10).replace(/-/g, '')
  const title = `${periodString}` // (${fromDateStr}-${toDateStr})`
  console.log(`\ntagStats: ${title} (${fromDateStr}-${toDateStr}):`)
  const results = calcTagStatsPeriod(fromDateStr, toDateStr)
  // The .sort method needs a function to sort non string values
  // Here it's sorting arrays of two values each.
  const sortedResults = new Map(
    [...(results?.entries() ?? [])].sort(([key1, _v1], [key2, _v2]) =>
      key1.localeCompare(key2),
    ),
  )
  const outputArray = []
  for (const elem of sortedResults.entries()) {
    let hashtagString = (pref_showAsHashtag) ? elem[0] : elem[0].slice(1)
    outputArray.push(`${elem[1]}\t${hashtagString}`)
  }

  const labelString = `🗒 Add/update note '${periodString}' in folder '${pref_folderToStore}'`
  const destination = await chooseOption(
    `Where to save the summary for ${outputArray.length} hashtags?`,
    [
      {
        // TODO: When weekly/monthly notes are made possible in NP, then add options like this
        //   label: "📅 Append to today's note",
        //   value: "today"
        // }, {
        label: labelString,
        value: 'note',
      },
      {
        label: '🖥 Pop-up display',
        value: 'show',
      },
      {
        label: '🖊 Write to console log',
        value: 'log',
      },
      {
        label: '❌ Cancel',
        value: 'cancel',
      },
    ],
    'show',
  )

  // Ask where to send the results
  switch (destination) {
    case 'today': {
      const todaysNote = await DataStore.calendarNoteByDate(new Date())
      if (todaysNote == null) {
        console.log(`\terror appending to today's note`)
      } else {
        console.log(
          `\tappending results to today's note (${todaysNote.filename ?? ''})`,
        )
        // I suggest adding to the content directly instead
        todaysNote.appendParagraph(`### Hashtag Counts for ${title}`, 'empty')
        todaysNote.appendParagraph(outputArray.join('\n'), 'empty')
        console.log(`\tappended results to today's note`)
      }
      break
    }
    case 'note': {
      let note: ?TNote
      // first see if this note has already been created
      // (look only in active notes, not Archive or Trash)
      const existingNotes: $ReadOnlyArray<TNote> =
        await DataStore.projectNoteByTitle(title, true, false)
      console.log(`\tfound ${existingNotes.length} existing summary notes for this period`)

      if (existingNotes.length > 0) {
        note = existingNotes[0] // pick the first if more than one
        console.log(`\tfilename of first matching note: ${note.filename}`)
      } else {
        // make a new note for this
        let noteFilename = await DataStore.newNote(title, pref_folderToStore)
        console.log(`\tnewNote filename: ${noteFilename}`)
        noteFilename = `${pref_folderToStore}/${noteFilename}` ?? '(error)'
        // NB: filename here = folder + filename
        note = await DataStore.projectNoteByFilename(noteFilename)
        console.log(`\twriting results to the new note '${noteFilename}'`)
      }

      if (note != null) {
        const nonNullableNote = note
        // Do we have an existing Hashtag counts section? If so, delete it.
        const insertionLineIndex = await removeSection(nonNullableNote, pref_countsHeading)
        console.log(`\tinsertionLineIndex: ${insertionLineIndex}`)
        // Set place to insert either after the found section heading, or at end of note
        nonNullableNote.insertHeading(countsHeading, insertionLineIndex, pref_countsHeadingLevel)
        nonNullableNote.insertParagraph(outputArray.join('\n'), insertionLineIndex + 1, 'empty')
      } else {
        // FIXME: gets here when writing a new note
        console.log("tagStats: error: shouldn't get here -- no valid note to write to")
        return
      }

      console.log(`\twritten results to note '${title}'`)
      break
    }

    case 'log': {
      console.log(outputArray.join('\n'))
      break
    }

    case 'cancel': {
      break
    }

    default: {
      const re = await CommandBar.showOptions(outputArray, 'Tag counts.  (Select anything to copy)')
      if (re !== null) {
        Clipboard.string = outputArray.join('\n')
      }
      break
    }
  }
  //   await showMessage('Everything is already up to date here!');
}

// remove all paragraphs in a section, given:
// - Section heading line to look for (needs to match from start but not end)
// - Array of paragraphs
// Returns the lineIndex of the found heading, or if not found the last line of the note
async function removeSection(note: TNote, heading: string): number {
  let existingHeadingIndex
  const ps = note.paragraphs
  const thisTitle = note.title ?? ''
  console.log(`\t  removeSection '${pref_countsHeading}' from note '${thisTitle}' with ${ps.length} paras:`)

  for (const p of ps) {
    if (p.type === 'title' && p.content.startsWith(heading)) {
      existingHeadingIndex = p.lineIndex
    }
  }

  if (existingHeadingIndex !== undefined) {
    console.log(`\t    heading at: ${existingHeadingIndex}`)
    // Work out the set of paragraphs to remove
    // console.log(`Heading found at line: ${existingHeadingIndex}`)
    // let psToRemove = []
    note.removeParagraph(ps[existingHeadingIndex])
    let removed = 1
    for (let i = existingHeadingIndex + 1; i < ps.length; i++) {
      if (ps[i].type === 'title' || ps[i].content === '') {
        break
      }
      // psToRemove.push(ps[i])
      await note.removeParagraph(ps[i])
      removed++
    }
    console.log(`\t   Removed ${removed} paragraphs. ${existingHeadingIndex}`)

    // Delete the saved set of paragraphs
    // TODO: think this is hitting NP API bug?
    // console.log(`About to remove ${psToRemove.length} paragraphs`)
    // note.removeParagraphs(psToRemove)
    // console.log(`Removed ${psToRemove.length} paragraphs`);
    return existingHeadingIndex
  } else {
    return ps.length
  }
}

//-------------------------------------------------------------------------------
// Calculate tag statistics for daily notes of a given time period
// Returns a Map of {tag, count}

function calcTagStatsPeriod(fromDateStr, toDateStr): ?Map<string, number> {
  // Get all daily notes that are within this time period
  const periodDailyNotes = DataStore.calendarNotes.filter((p) =>
    withinDateRange(
      dateStringFromCalendarFilename(p.filename),
      fromDateStr,
      toDateStr,
    ),
  )

  if (periodDailyNotes.length === 0) {
    console.log('\twarning: no matching daily notes found')
    return
  } else {
    console.log(`\tfound ${periodDailyNotes.length} matching daily notes`)
  }

  // For each matching date, find and store the tags in Map
  const tags = new Map<string, number>() // key: tagname; value: count
  for (const n of periodDailyNotes) {
    const includedTags = n.hashtags // TODO: later .mentions too?
    // console.log(`i:${i} -> ${n.hashtags.join(' / ')}`)
    for (const tag of includedTags) {
      tags.set(tag, (tags.get(tag) ?? 0) + 1)
      // console.log(`  j:${j} ${tag} = ${tags.get(tag)}`)
    }
  }
  return tags
}

// function removeDateTags(content) {
//   return content.replace(/<\d{4}-\d{2}-\d{2}/g, '').replace(/>\d{4}-\d{2}-\d{2}/g, '').trim();
// }

// async function sweepFile() {
//   const type = Editor.type;
//   const note = Editor.note;

//   if (note == null) {
//     return;
//   }

//   if (type === 'Calendar') {
//     const todayNoteFileName = filenameDateString(new Date()) + '.' + DataStore.defaultFileExtension;

//     if (Editor.filename == todayNoteFileName) {
//       await CommandBar.showInput('Open a different note than today', 'OK');
//       return;
//     }

//     return await sweepCalendarNote(note);
//   } else {
//     return await sweepProjectNote(note);
//   }
// }

// const OPTIONS = [{
//   label: '7 days',
//   value: {
//     num: 7,
//     unit: 'day'
//   }
// }, {
//   label: '14 days',
//   value: {
//     num: 14,
//     unit: 'day'
//   }
// }, {
//   label: '21 days',
//   value: {
//     num: 21,
//     unit: 'day'
//   }
// }, {
//   label: '1 month',
//   value: {
//     num: 1,
//     unit: 'month'
//   }
// }, {
//   label: '3 months',
//   value: {
//     num: 3,
//     unit: 'month'
//   }
// }, {
//   label: '6 months',
//   value: {
//     num: 6,
//     unit: 'month'
//   }
// }, {
//   label: '1 year',
//   value: {
//     num: 1,
//     unit: 'year'
//   }
// }, {
//   label: '❌ Cancel',
//   value: {
//     num: 0,
//     unit: 'day'
//   }
// }];
// const DEFAULT_OPTION = {
//   unit: 'day',
//   num: 0
// };
// /**
//  * TODO:
//  * 1. Add option to move all tasks silently
//  * 2. Add option to reschedule instead of move Calendar notes
//  * 3. Add option to change target date from "Today" to something you can choose
//  *  */

// async function sweepAll() {
//   const {
//     unit,
//     num
//   } = await chooseOption('🧹 Reschedule tasks to today of the last...', OPTIONS, DEFAULT_OPTION);

//   if (num == 0) {
//     // User canceled, return here, so no additional messages are shown
//     await showMessage(`Cancelled! No changes made.`);
//     return;
//   }

//   const afterDate = Calendar.addUnitToDate(new Date(), unit, -num);
//   const afterDateFileName = filenameDateString(Calendar.addUnitToDate(new Date(), unit, -num));
//   const re1 = await CommandBar.showOptions(['✅ OK', '❌ Skip'], '📙 Processing with your Project Notes first...');

//   if (re1.index == 0) {
//     for (const note of DataStore.projectNotes) {
//       await sweepProjectNote(note, true, hyphenatedDateString(afterDate), false);
//     }
//   }

//   const re2 = await CommandBar.showOptions(['✅ OK', '❌ Skip'], '🗓 Now processing your Daily Notes...');

//   if (re2.index == 0) {
//     const todayFileName = filenameDateString(new Date());
//     const recentCalNotes = DataStore.calendarNotes.filter(note => note.filename < todayFileName && note.filename >= afterDateFileName);

//     for (const note of recentCalNotes) {
//       await sweepCalendarNote(note, true, false);
//     }
//   }

//   await showMessage(`All Done!`);
// }
