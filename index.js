const { Note } = require('inkdrop').models

module.exports = {
  activate() {
    this.subscription = inkdrop.commands.add(document.body, {
      'export-as-html:selections': e => this.exportAsHtmlCommand(e),
      'export-as-html:copy': e => this.copyAsHtmlCommand(e),
      'export-as-html:copy-simple': e => this.copyAsSimpleHtmlCommand(e),
      'export-as-html:notebook': e => this.exportNotebook(e)
    })
  },

  deactivate() {
    this.subscription.dispose()
  },

  async exportAsHtmlCommand(e) {
    const {
      exportMultipleNotesAsHtml,
      exportNoteAsHtml
    } = require('./exporter')
    const { noteListBar, editingNote } = inkdrop.store.getState()
    const { actionTargetNoteIds } = noteListBar
    const noteIds = e.detail?.noteId ? [e.detail.noteId] : (actionTargetNoteIds.length > 0 ? actionTargetNoteIds : [editingNote?._id])
    if (noteIds && noteIds.length > 1) {
      inkdrop.notifications.addInfo('Exporting notes started', {
        detail: 'It may take a while..',
        dismissable: true
      })
      await exportMultipleNotesAsHtml(noteIds)
      inkdrop.notifications.addInfo('Exporting notes completed', {
        detail: '',
        dismissable: true
      })
    } else if (noteIds.length === 1) {
      const note = await Note.loadWithId(noteIds[0])
      exportNoteAsHtml(note)
    } else {
      inkdrop.notifications.addError('No note opened', {
        detail: 'Please open a note to export as HTML',
        dismissable: true
      })
    }
  },

  async copyAsHtmlCommand(e) {
    const { copyNoteAsHtml } = require('./exporter')
    const { noteListBar } = inkdrop.store.getState()
    const { actionTargetNoteIds } = noteListBar
    const noteId = e.detail?.noteId || actionTargetNoteIds?.[0]
    if (noteId) {
      const note = await Note.loadWithId(noteId)
      copyNoteAsHtml(note)
    }
  },

  async copyAsSimpleHtmlCommand(e) {
    const { copyNoteAsSimpleHtml } = require('./exporter')
    const { noteListBar } = inkdrop.store.getState()
    const { actionTargetNoteIds } = noteListBar
    const noteId = e.detail?.noteId || actionTargetNoteIds?.[0]
    if (noteId) {
      const note = await Note.loadWithId(noteId)
      copyNoteAsSimpleHtml(note)
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
