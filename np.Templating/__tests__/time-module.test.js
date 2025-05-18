/* eslint-disable */

import colors from 'chalk'
import TimeModule from '../lib/support/modules/TimeModule'
import { currentTime, time } from '../lib/support/modules/TimeModule'
import moment from 'moment/min/moment-with-locales'

const PLUGIN_NAME = `📙 ${colors.yellow('np.Templating')}`
const section = colors.blue
const block = colors.magenta.green
const method = colors.magenta.bold

describe(`${PLUGIN_NAME}`, () => {
  beforeEach(() => {
    global.DataStore = {
      settings: { logLevel: 'none' },
    }
  })
  describe(section('TimeModule'), () => {
    it(`should render ${method('.now')}`, async () => {
      const result = new TimeModule().now('h:mm A')
      expect(result).toEqual(moment(new Date()).format('h:mm A'))
    })

    it(`should render ${method('.now')} using 'short' format`, () => {
      const result = new TimeModule().now('short')

      const test = new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(new Date())

      expect(result).toEqual(test)
    })

    it(`should render ${method('.now')} using 'medium' format`, () => {
      const result = new TimeModule().now('medium')

      const test = new Intl.DateTimeFormat('en-US', { timeStyle: 'medium' }).format(new Date())

      expect(result).toEqual(test)
    })

    it(`should render ${method('.now')} using 'long' format`, () => {
      const result = new TimeModule().now('long')

      const test = new Intl.DateTimeFormat('en-US', { timeStyle: 'long' }).format(new Date())

      expect(result).toEqual(test)
    })

    it(`should render ${method('.now')} using 'full' format`, () => {
      const result = new TimeModule().now('full')

      const test = new Intl.DateTimeFormat('en-US', { timeStyle: 'full' }).format(new Date())

      expect(result).toEqual(test)
    })

    it(`should render${method('.now')} using custom format`, async () => {
      const result = new TimeModule().now('hh:mm')
      expect(result).toEqual(moment(new Date()).format('hh:mm'))
    })

    it(`should render ${method('.now')} using configuration`, async () => {
      const testConfig = {
        timeFormat: 'hh:mm A',
      }
      const result = new TimeModule(testConfig).now()
      expect(result).toEqual(moment(new Date()).format('hh:mm A'))
    })

    it(`should render ${method('.currentTime')}`, async () => {
      const result = new TimeModule().currentTime('h:mm A')
      expect(result).toEqual(moment(new Date()).format('h:mm A'))
    })

    it(`should format supplied time`, async () => {
      const result = new TimeModule().format('hh:mm A', '2021-10-16 6:55 AM')

      const dateValue = new Date('2021-10-16 6:55 AM').toLocaleString()
      const assertValue = moment(new Date(dateValue)).format('hh:mm A')

      expect(result).toEqual(assertValue)
    })

    it(`should format current time when no date is supplied`, () => {
      const timeModule = new TimeModule()
      const formatString = 'h:mm:ss A'
      const result = timeModule.format(formatString)
      // We expect it to format the current time, so we compare against moment() with the same format.
      // To avoid issues with the exact second the test runs, we can either:
      // 1. Mock the date (more complex for a single test here)
      // 2. Check if the format is correct and it roughly matches the current time.
      // For simplicity, let's check if it matches moment's formatting of now.
      // Note: this could still rarely fail if the second ticks over between the call and the expect.
      const expected = moment().format(formatString)
      expect(result).toEqual(expected)
    })

    describe(block(`TimeModule helpers`), () => {
      it(`time`, () => {
        // replacing 0x202F with a space because for some reason, in node 18
        // time formatting comes with this character instead of a space
        const result = new TimeModule().now().replace(' ', ' ')

        const assertValue = time('h:mm A')

        expect(result).toEqual(assertValue)
      })

      it(`${method('.currentTime')}`, () => {
        // see replacement note above
        const result = new TimeModule().now().replace(' ', ' ')

        const assertValue = currentTime()

        expect(result).toEqual(assertValue)
      })
    })
  })
})
