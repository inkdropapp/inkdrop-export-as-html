const remote = require('electron').remote
const path = require('path')
const fs = require('fs')
const dialog = remote.dialog

module.exports = {
  activate() {
    this.subscription = inkdrop.commands.add(document.body, {
      'export-as-html:export': () => this.exportAsHtmlCommand()
    })
  },

  async exportAsHtmlCommand() {
    const { noteListBar, notes } = inkdrop.store.getState()
    if (noteListBar.selectedNoteIds.length > 1) {
      inkdrop.notifications.addInfo('Exporting notes started', {
        detail: 'It may take a while..',
        dismissable: true
      })
      await this.exportMultipleNotesAsHtml(noteListBar.selectedNoteIds)
      inkdrop.notifications.addInfo('Exporting notes completed', {
        detail: '',
        dismissable: true
      })
    } else if (noteListBar.selectedNoteIds.length === 1) {
      const note = notes.hashedItems[noteListBar.selectedNoteIds[0]]
      this.exportNoteAsHtml(note)
    } else {
      inkdrop.notifications.addError('No note opened', {
        detail: 'Please open a note to export as HTML',
        dismissable: true
      })
    }
  },

  async exportMultipleNotesAsHtml(noteIds) {
    const { notes } = inkdrop.store.getState()
    const { filePaths: res } = await dialog.showOpenDialog(inkdrop.window, {
      title: 'Select Destination Directory',
      properties: ['openDirectory']
    })
    if (res instanceof Array && res.length > 0) {
      const destDir = res[0]

      for (let noteId of noteIds) {
        const note = notes.hashedItems[noteId]
        if (note) {
          const pathToSave = path.join(destDir, `${note.title}.html`)
          await this.exportNoteAsHtml(note, pathToSave)
        }
      }
    }
  },

  async exportNoteAsHtml(note, pathToSave) {
    const exportUtils = require('inkdrop-export-utils')

    if (typeof pathToSave !== 'string') {
      const res = await dialog.showSaveDialog(inkdrop.window, {
        title: 'Save HTML file',
        defaultPath: `${note.title}.html`,
        filters: [
          { name: 'HTML Files', extensions: ['html'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })
      pathToSave = res.filePath
    }

    if (typeof pathToSave === 'string' && pathToSave.length > 0) {
      let markdown = note.body
      const dirToSave = path.dirname(pathToSave)
      markdown = await exportUtils.replaceImages(markdown, dirToSave, dirToSave)
      const outputHtml = await exportUtils.createHTML({
        ...note,
        body: markdown
      })

      try {
        fs.writeFileSync(pathToSave, outputHtml, 'utf-8')
      } catch (e) {
        inkdrop.notifications.addError('Failed to save HTML', {
          detail: e.message,
          dismissable: true
        })
      }
    }
  },

  deactivate() {
    this.subscription.dispose()
  }
}
