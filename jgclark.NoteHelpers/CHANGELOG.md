# What's changed in 📙 Note Helpers plugin?
For more details see the [plugin's README](https://github.com/NotePlan/plugins/tree/main/jgclark.NoteHelpers/).

<!-- 
- ??? Shift /new note etc. from Filers plugin
- ??? Look at spinning out Index... commands to separate plugin 
- -->

## [1.2.0] - 2025-06-13???
- various improvements/fixes to the **inconsistent file name** commands. Resolves issues #640, #642, #643 raised by @tastapod.

## [1.1.1] - 2025-04-22
- the **log Editor Note** commands now handle Teamspace notes correctly.
- fix to opening new notes in **new note** commands.

## [1.1.0] - 2025-02-19
- new **list published notes** command, that generates a list in the new 'Publlished Notes' note of all notes that have been published to published to the internet through NotePlan.

## [1.0.0] - 2024-12-31
### New
- the **new note** command has been revived (alias **nn**). It creates a new (regular, not calendar) note with a title you give, and in a folder you can select. If the "Default Text to add to frontmatter" setting isn't blank, then the note will be created using that frontmatter.

_Note: this version was promoted to be a Core Plugin from NotePlan 3.16.1._

### Important Changes
- when **move note** shows the list of folders, the special Templates and Archive folders are moved to the end of the list. (Plus any other special ones that start with '@').
- the **new note from clipboard** and **new note from selection** commands have moved from Filer plugin to NoteHelpers.

## [0.20.3] - 2024-12-25 (unpublished)
- new **logEditorNoteDetailed** command (which can easily triggered from a callback) that also logs line type and rawContents

## [0.20.2] - 2024-12-15
- the **log note details** command now includes backlink-ed notes and paragraphs

## [0.20.1] - 2024-10-22
- new **log note details** command which prints note details to the log (for debugging purposes)

## [0.20.0] - 2024-08-16
### Added
- new **delete note** command, that makes easier what the current NotePlan UI makes difficult.
- new **find unlinked notes** command which finds and creates links to existing notes in the current note (by @aaronpoweruser).
![Unlinked notes demo](docs/unlinked_note_demo.gif)

### Fixed
- fixed **rename note filename** when note has frontmatter (thanks for the report, @ariccb)

## [0.19.2] - 2024-04-27
- **add trigger to note** command is now more resilient to unusual frontmatter, and shouldn't duplicate an existing trigger when run from template

## [0.19.1] - 2024-02-23
- **add trigger to note** command can now be run from x-callback with parameter of the trigger string to add. This means it can be run from Templates with a command tag.
- Added a migration message about 'open note' commands.

## [0.19.0] - 2024-01-09
- moved the "open note in ..." commands to the new "Window Tools" plugin
- updated the display of the "index folders" command to use heading levels H2 to H4 depending on how deep the sub-folder is. The placeholder in the title `{{folder}}` now just uses the last part of the folder name, or new placeholder `{{full_folder_path}}` which will use the folder's full path. (Requested by @dutchnesss).
- removed 'Show month/quarter/year' commands as they are now in the main NP menus.
- fix to '/rename inconsistent filename' command (reported by @anton-sklyar)
- fix to '/make index' command ignoring parameter 'displayOrder' if given.

## [0.18.2] - 2023-09-18
- fix edge case with /add trigger command.

## [0.18.1] - 2023-08-15
- New commands by @Leo:
  - **list inconsistent note filenames** lists the names of notes whose filenames are inconsistent with their titles
  - **rename filename to title** renames the current filename to the title of the note
- when the command bar shows list of notes to choose, it now includes Template files again.

## [0.18.0] - 2023-08-13
- new command **Show This Month** (alias /stm)
- new command **Show This Quarter** (alias /stq)
- new command **Show This Year** (alias /sty) (requested by @danieldanilov)
- new command **update all indexes** that updates all the existing folder index notes
- added more decoration to most-used calendar dates, when showing them in lists of notes (e.g. in "jump to note's heading" and "open note new window").

## [0.17.3] - 2023-07-01
- added new setting 'Title to use for index notes' for "/index folders" command (requested by @dwertheimer)
- layout improvements and further bug fix  in "/index folders" (spotted by @dwertheimer)

## [0.17.2] - 2023-06-30
### Fixed
- fix bug in **index folders** command (spotted by @dwertheimer)

## [0.17.0] - 2023-06-12
### Added
- new **open url from a note** command that asks user for a note, and then presents a list of URLs. The selected one is then opened in your default browser. (for @John1 with help from @dwertheimer)
- now **move note** and **index folders** commands offer option to create a new folder when selecting a folder (suggested by @dwertheimer)
- new **reset caches** command that just runs the command of that name in the NotePlan Help menu (for @clayrussell)

## [0.16.1] - 2023-03-22
### Added
- added **NoteHelpers: update settings** command for iOS users
- added setting for logging level
### Changed
- '/add trigger to note' command now is smarter in the way it works
- restores "Default Text to add to frontmatter" setting for '/convert note to frontmatter' command

## [0.16.0] - 2023-03-07
### Added
- new **add trigger to note** command that makes it easy to add a trigger to a particular note. It lists the functions from all plugins that it can work out are written for triggers, but also allows any function to be picked.
- **index folders** command now:
  - has an option to sort output by title (alphabetical), last update date, or date the note was created (though note that I think that the underlying created date data is very unreliable).
  - has an option to add one of several date display settings on the end of every note that's listed
  - has a Refresh button at the top of each results set
  - can be run from x-callback-url calls (see README).
### Fixed
- **convert to frontmatter** command wasn't always working for calendar notes

## [0.15.0] - 2022-07-30
### Added
- new command **rename note filename** renames the currently open note. Note: this changes the underlying _filename_ not the visible _title_. (It only works with NotePlan v3.6.1 and later.)
- new command **enable heading links** converts local links to headings (they start with the `#` character) to `x-callback-url` links that use the Noteplan URL-scheme to run the `jumpToHeading` function mentioned below. So while Noteplan doesn't support the standard way of linking to headings within notes, this plugin command now enables that feature if you're willing to change the destination of your links.  (by @nmn)
### Updated
- The **jump to heading** command (which is used for jumping to headings within the same note) can now be used via `x-callback-url`s by passing the text of the heading in as an arg0.

## [0.14.1] - 2022-06-12 (by @nmn)
### Added
- new command **add number of days to dates** that looks for bullets in your current open note that end with `[[YYYY-MM-DD]]:` and adds the number of days to or since that date.

## [0.13.0] - 2022-06-02
### Added
- new command **/open current note new split** opens the current note in a new split window to the side in the main window

## [0.12.0..0.12.1] - 2022-06-02
### Added
- command **/convert to frontmatter** which convert the current note to use frontmatter syntax, including optional default text that can be added in the Plugin's settings.
### Changed
- when using **/open note new window** or **/open note new split** it now places the cursor at what it judges to be the start of the main content of the note (i.e. after title or frontmatter) or project-related metadata.

## [0.11.0..0.11.1] - 2022-05-10
### Added
- added `/open note split` command to open a user-selected note in a new split window (available from NotePlan 3.4)
### Changed
- updated logging to newer framework
- switched to using longer descriptive command names. The older short names will still work as aliases
- the `/index` command now adds time since note was last updated in the output
- when jumping to a heading, those in the archive part of the note (Done... or Cancelled...) now aren't offered

## [0.10.0..0.10.6] - 2021-11-17
### Added
- added **/onw** command to open a user-selected note in a new window.
- added **/index** command to make/update note link Indexes for one or more folders
### Changed
- updated the 'jumping' commands /jh and /jd work better with API change
- now 'move' or 'jump' to daily notes, not just project notes
- now allows notes to be moved to the special @Archive directory (requested by @brokosz)
- now compiled for versions of macOS back to 10.13.0

## [0.9.0..0.9.3] - 2021-07-07
### Added
- added **/jn** command to jump to a different note, and then user selected heading

### Changed
- moved **/nns** (which was temporarily here) to Filer and cleaned up here

### Fixed
- fix: 'undefined' error in /mn

## [0.8.0..0.8.2] - 2021-06-07
### Changed
- change: remove **/it** and **/nn** in favour of updated versions in the 'nmn.Templates' plugin
- change: **/jh** now indents the different heading levels
- change: **/nn** now asks for the folder to create the new note in
- remove preference variables no longer needed with the '📋 Templates' folder mechanism

### Fixed
- fix: the **/jd** command now works if the Done section has been folded

## [0.7.0..0.7.2] - 2021-05-22
- Updated applyTemplate() and newNote() so that they pick a template from a folder. This '📋 Templates' folder - along with sample templates - will be created if non-existing.
- change to using two-letter command names, to match new style agreed with EM
- move the **/show statistics** command to a separate statistics plugin
- add option to copy to clipboard statistics summary

## [0.6.1] - 2021-05-14
### Added
- add the **/jump to Done** command
- add option to copy to clipboard statistics summary

## [0.5.0] - 2021-05-08
### Added
- moved the example plugin **/move Note** command to this plugin

## [0.4.0] - 2021-05-07
### Added
- added multiple templates to **/newNote**
- added **/applyTemplate** command

## [0.3.0..0.3.2]
### Added
- show statistics output on the command bar as well
- added **/statistics**: for now this only writes to the console log (open from the Help menu)

## [0.2.0]
- added **/newNote** command
