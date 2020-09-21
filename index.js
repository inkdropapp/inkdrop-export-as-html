const { remote, clipboard } = require('electron')
const path = require('path')
const fs = require('fs')
const dialog = remote.dialog

module.exports = {
  activate() {
    this.subscription = inkdrop.commands.add(document.body, {
      'export-as-html:selections': () => this.exportAsHtmlCommand(),
      'export-as-html:copy': () => this.copyAsHtmlCommand(),
      'export-as-html:notebook': (e) => this.exportNotebook(e)
    })
  },

  deactivate() {
    this.subscription.dispose()
  },

  async exportAsHtmlCommand() {
    const { exportMultipleNotesAsHtml, exportNoteAsHtml } = require('./exporter')
    const { noteListBar, notes } = inkdrop.store.getState()
    const { actionTargetNoteIds } = noteListBar
    if(actionTargetNoteIds && actionTargetNoteIds.length > 1) {
      inkdrop.notifications.addInfo('Exporting notes started', {
        detail: 'It may take a while..',
        dismissable: true
      })
      await exportMultipleNotesAsHtml(actionTargetNoteIds)
      inkdrop.notifications.addInfo('Exporting notes completed', {
        detail: '',
        dismissable: true
      })
    } else if (actionTargetNoteIds.length === 1) {
      const note = notes.hashedItems[actionTargetNoteIds[0]]
      exportNoteAsHtml(note)
    } else {
      inkdrop.notifications.addError('No note opened', {
        detail: 'Please open a note to export as HTML',
        dismissable: true
      })
    }
  },

  async copyAsHtmlCommand() {
    const { copyNoteAsHtml } = require('./exporter')
    const { noteListBar, notes } = inkdrop.store.getState()
    const { actionTargetNoteIds } = noteListBar
    if(actionTargetNoteIds && actionTargetNoteIds.length > 0) {
      const note = notes.hashedItems[actionTargetNoteIds[0]]
      copyNoteAsHtml(note)
    }
  },

  exportNotebook(e) {
    const {
      bookList: { bookForContextMenu }
    } = inkdrop.store.getState()
    const bookId = (e.detail || {}).bookId || (bookForContextMenu || {})._id
    if (bookId) {
      const { exportNotesInBook } = require('./exporter')
      exportNotesInBook(bookId)
    } else {
      inkdrop.notifications.addError('No notebook specified', {
        detail: 'Please select a notebook to export on sidebar',
        dismissable: true
      })
    }
  }
}
