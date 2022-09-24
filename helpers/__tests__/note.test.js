/* global describe, test, expect, beforeAll */
import colors from 'chalk'
import * as n from '../note'
import { DataStore, Calendar } from '@mocks/index'
import { hyphenatedDateString } from '@helpers/dateTime'

const PLUGIN_NAME = `📙 ${colors.yellow('helpers/note')}`
const section = colors.blue

beforeAll(() => {
  global.DataStore = DataStore // so we see DEBUG logs in VSCode Jest debugs
  global.Calendar = Calendar
})

// Jest suite
describe(`${PLUGIN_NAME}`, () => {
  describe(section('helpers/calendar.js'), () => {
    /*
     * findOverdueDatesInString()
     */
    describe('findOverdueDatesInString()' /* function */, () => {
      test('should find no date in line with no overdue', () => {
        const result = n.findOverdueDatesInString('>2922-01-01')
        expect(result.length).toEqual(0)
      })
      test('should find date in line with overdue', () => {
        const result = n.findOverdueDatesInString('>1999-01-01')
        expect(result.length).toEqual(1)
        expect(result).toEqual(['>1999-01-01'])
      })
      test('should find 2 overdue dates', () => {
        const result = n.findOverdueDatesInString('>1999-01-01 >1998-01-01')
        expect(result.length).toEqual(2)
      })
    })
    /*
     * getOverdueParagraphs()
     */
    describe('getOverdueParagraphs()' /* function */, () => {
      describe('>ISODate date tests' /* function */, () => {
        test('should send back empty array when there is no date in type Calendar', () => {
          const note = { type: 'Calendar', filename: '20201212.md', datedTodos: [{ type: 'open', content: 'foo bar' }] }
          const result = n.getOverdueParagraphs(note)
          expect(result).toEqual([])
        })
        test('should send back empty array when there is no date in type Notes', () => {
          const note = { type: 'Notes', filename: 'foos.md', datedTodos: [{ type: 'open', content: 'foo bar' }] }
          const result = n.getOverdueParagraphs(note)
          expect(result).toEqual([])
        })
        test('should send back empty array when there is no date in Weekly Note', () => {
          const note = { type: 'Calendar', filename: '2020-W20.md', datedTodos: [{ type: 'open', content: 'foo bar' }] }
          const result = n.getOverdueParagraphs(note)
          expect(result).toEqual([])
        })
        test('should find a basic overdue date', () => {
          const note = { type: 'Calendar', filename: '20201212.md', datedTodos: [{ type: 'open', content: 'foo bar >1999-01-01' }] }
          const result = n.getOverdueParagraphs(note)
          expect(result.length).toEqual(1)
          expect(result[0].content).toEqual('foo bar')
        })
        test('should find a overdue date at start', () => {
          const note = { type: 'Calendar', filename: '20201212.md', datedTodos: [{ type: 'open', content: '>1999-01-01 foo bar' }] }
          const result = n.getOverdueParagraphs(note)
          expect(result.length).toEqual(1)
          expect(result[0].content).toEqual('foo bar')
        })
        test('should find a overdue date in middle', () => {
          const note = { type: 'Calendar', filename: '20201212.md', datedTodos: [{ type: 'open', content: ' foo >1999-01-01 bar ' }] }
          const result = n.getOverdueParagraphs(note)
          expect(result.length).toEqual(1)
          expect(result[0].content).toEqual('foo bar')
        })
        test('should find multiple dates in multiple notes', () => {
          const note = {
            type: 'Calendar',
            filename: '20201212.md',
            datedTodos: [
              { type: 'open', content: ' foo >1999-01-01 bar ' },
              { type: 'open', content: ' sam >2000-01-01 jaw ' },
            ],
          }
          const result = n.getOverdueParagraphs(note)
          expect(result.length).toEqual(2)
          expect(result[1].content).toEqual('sam jaw')
        })
        test('should ignore lines that are not open', () => {
          const note = {
            type: 'Calendar',
            filename: '20201212.md',
            datedTodos: [
              { type: 'open', content: ' foo >1999-01-01 bar ' },
              { type: 'done', content: ' sam >2000-01-01 jaw ' },
              { type: 'open', content: ' sam >2000-01-01 jaw ' },
            ],
          }
          const result = n.getOverdueParagraphs(note)
          expect(result.length).toEqual(2)
          expect(result[1].content).toEqual('sam jaw')
        })
      })
      // NOTE: weekly tests are in NPNote.test.js
      describe('Combined weekly and date tests' /* function */, () => {
        test('should find one date and one week overdue', () => {
          const note = {
            type: 'Calendar',
            filename: '20201212.md',
            datedTodos: [
              { type: 'open', content: ' foo >1999-01-01 bar ' },
              { type: 'open', content: ' sam >2000-W01 jaw ' },
            ],
          }
          const result = n.getOverdueParagraphs(note)
          expect(result.length).toEqual(2)
          expect(result[1].content).toEqual('sam jaw')
        })
        test('should find one week when one date is not overdue', () => {
          const note = {
            type: 'Calendar',
            filename: '20201212.md',
            datedTodos: [
              { type: 'open', content: ' foo >3000-01-01 bar ' },
              { type: 'open', content: ' sam >2000-W01 jaw ' },
            ],
          }
          const result = n.getOverdueParagraphs(note)
          expect(result.length).toEqual(1)
          expect(result[0].content).toEqual('sam jaw')
        })
        test('should find one date when one week is not overdue', () => {
          const note = {
            type: 'Calendar',
            filename: '20201212.md',
            datedTodos: [
              { type: 'open', content: ' foo >2000-01-01 bar ' },
              { type: 'open', content: ' sam >3000-W01 jaw ' },
            ],
          }
          const result = n.getOverdueParagraphs(note)
          expect(result.length).toEqual(1)
          expect(result[0].content).toEqual('foo bar')
        })
      })
    })

    /*
     * updateDatePlusTags()
     */
    describe('updateDatePlusTags()' /* function */, () => {
      test('should find and return an overdue+ para', () => {
        const note = { datedTodos: [{ type: 'open', content: 'foo >2020-01-01+' }] }
        const options = { openOnly: false, plusOnlyTypes: true, replaceDate: false }
        const result = n.updateDatePlusTags(note, options)
        expect(result[0].content).toMatch(/>today/)
      })
      test('should not find and return a plain (non +) overdue para when 3rd pram is true', () => {
        const note = { datedTodos: [{ type: 'done', content: 'foo >2020-01-01' }] }
        const options = { openOnly: false, plusOnlyTypes: true, replaceDate: true }
        const result = n.updateDatePlusTags(note, options)
        expect(result).toEqual([])
      })
      test('should find and return a plain (non +) overdue para when 3rd pram is true', () => {
        const note = { datedTodos: [{ type: 'done', content: 'foo >2020-01-01' }] }
        const options = { openOnly: false, plusOnlyTypes: false, replaceDate: false }
        const result = n.updateDatePlusTags(note, options)
        expect(result[0].content).toMatch(/>today/)
      })
      test('should not find and return an overdue+ para if its not open', () => {
        const note = { datedTodos: [{ type: 'done', content: 'foo >2020-01-01+' }] }
        const options = { openOnly: true, plusOnlyTypes: false, replaceDate: false }
        const result = n.updateDatePlusTags(note, options)
        expect(result).toEqual([])
      })
      test('should find and return an overdue+ para if is open', () => {
        const note = { datedTodos: [{ type: 'open', content: 'foo >2020-01-01+' }] }
        const options = { openOnly: true, plusOnlyTypes: false, replaceDate: false }
        const result = n.updateDatePlusTags(note, options)
        expect(result[0].content).toMatch(/>today/)
      })
      test('should find and return a plain (non +) overdue para if is open', () => {
        const note = { datedTodos: [{ type: 'open', content: 'foo >2020-01-01' }] }
        const options = { openOnly: true, plusOnlyTypes: false, replaceDate: false }
        const result = n.updateDatePlusTags(note, options)
        expect(result[0].content).toMatch(/>today/)
      })
      test('should do nothing if there is already a >today', () => {
        const note = { datedTodos: [{ type: 'open', content: 'foo >2020-01-01 >today' }] }
        const options = { openOnly: true, plusOnlyTypes: false, replaceDate: false }
        const result = n.updateDatePlusTags(note, options)
        expect(result).toEqual([])
      })
      test('if there are multiple dates in one line and all dates are past, replace the latest with >today and leave the other', () => {
        const note = { datedTodos: [{ type: 'open', content: 'foo >2020-01-01 and >2021-12-31' }] }
        const options = { openOnly: true, plusOnlyTypes: false, replaceDate: true }
        const result = n.updateDatePlusTags(note, options)
        expect(result[0].content).toEqual(`foo >2020-01-01 and >today`)
      })
      test('if there are multiple dates in one line and all dates are past, replace the latest with >today and leave the other, no matter the order', () => {
        const note = { datedTodos: [{ type: 'open', content: 'foo and >2021-12-31 >2020-01-01' }] }
        const options = { openOnly: true, plusOnlyTypes: false, replaceDate: true }
        const result = n.updateDatePlusTags(note, options)
        expect(result[0].content).toEqual(`foo and >today >2020-01-01`)
      })
      test('if there are multiple dates in one line and one is in the future then do nothing', () => {
        const note = { datedTodos: [{ type: 'open', content: 'foo and >2044-12-31 >2020-01-01' }] }
        const options = { openOnly: true, plusOnlyTypes: false, replaceDate: false }
        const result = n.updateDatePlusTags(note, options)
        expect(result).toEqual([]) //make no change
      })
      test('should always convert a past due datePlus', () => {
        const note = { datedTodos: [{ type: 'open', content: 'foo and >2044-12-31 >2020-01-01+' }] }
        const options = { openOnly: true, plusOnlyTypes: true, replaceDate: true }
        const result = n.updateDatePlusTags(note, options)
        expect(result[0].content).toEqual('foo and >2044-12-31 >today')
      })

      test('should convert a datePlus for today', () => {
        const todayHyphenated = hyphenatedDateString(new Date())
        const note = { datedTodos: [{ type: 'open', content: `foo and >${todayHyphenated}+` }] }
        const options = { openOnly: true, plusOnlyTypes: false, replaceDate: true }
        const result = n.updateDatePlusTags(note, options)
        expect(result[0].content).toEqual('foo and >today')
      })

      test('should return multiple paras if is open', () => {
        const note = {
          datedTodos: [
            { type: 'open', content: 'foo >2020-01-01+' },
            { type: 'scheduled', content: 'foo >2020-01-01' },
            { type: 'open', content: 'bar >2020-01-01' },
          ],
        }
        const options = { openOnly: true, plusOnlyTypes: false, replaceDate: false }
        const result = n.updateDatePlusTags(note, options)
        expect(result.length).toEqual(2)
        expect(result[1].content).toMatch(/bar/)
      })

      test('should NOT consider today overdue (if no plus)', () => {
        const todayHyphenated = hyphenatedDateString(new Date())
        const note = { datedTodos: [{ type: 'open', content: `foo and >${todayHyphenated}` }] }
        const options = { openOnly: true, plusOnlyTypes: false, replaceDate: false }
        const result = n.updateDatePlusTags(note, options)
        expect(result).toEqual([]) //make no change
      })

      test('should leave dates in place if replaceDate is false', () => {
        const todayHyphenated = hyphenatedDateString(new Date())
        const note = { datedTodos: [{ type: 'open', content: `foo >2020-01-01` }] }
        const options = { openOnly: true, plusOnlyTypes: false, replaceDate: false }
        const result = n.updateDatePlusTags(note, options)
        expect(result[0].content).toEqual(`foo >2020-01-01 >today`) //make no change
      })

      test('should always replace date+ date with date if replaceDate is false', () => {
        const todayHyphenated = hyphenatedDateString(new Date())
        const note = { datedTodos: [{ type: 'open', content: `foo >2020-01-01+` }] }
        const options = { openOnly: true, plusOnlyTypes: false, replaceDate: false }
        const result = n.updateDatePlusTags(note, options)
        expect(result[0].content).toEqual(`foo >2020-01-01 >today`) //make no change
      })
    })
  })
})
