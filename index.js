const { remote, clipboard } = require('electron')
const path = require('path')
const fs = require('fs')
const dialog = remote.dialog

module.exports = {
  activate() {
    this.subscription = inkdrop.commands.add(document.body, {
      'export-as-html:export': () => this.exportAsHtmlCommand(),
      'export-as-html:copy': () => this.copyAsHtmlCommand()
    })
  },

  async exportAsHtmlCommand() {
    const { noteListBar, notes } = inkdrop.store.getState()
    const { actionTargetNoteIds } = noteListBar
    if(actionTargetNoteIds && actionTargetNoteIds.length > 1) {
      inkdrop.notifications.addInfo('Exporting notes started', {
        detail: 'It may take a while..',
        dismissable: true
      })
      await this.exportMultipleNotesAsHtml(actionTargetNoteIds)
      inkdrop.notifications.addInfo('Exporting notes completed', {
        detail: '',
        dismissable: true
      })
    } else if (actionTargetNoteIds.length === 1) {
      const note = notes.hashedItems[actionTargetNoteIds[0]]
      this.exportNoteAsHtml(note)
    } else {
      inkdrop.notifications.addError('No note opened', {
        detail: 'Please open a note to export as HTML',
        dismissable: true
      })
    }
  },

  async copyAsHtmlCommand() {
    const { noteListBar, notes } = inkdrop.store.getState()
    const { actionTargetNoteIds } = noteListBar
    if(actionTargetNoteIds && actionTargetNoteIds.length > 0) {
      const note = notes.hashedItems[actionTargetNoteIds[0]]
      this.copyNoteAsHtml(note)
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

    const outputHtml = await this.generateHtml(note, { pathToSave })

    try {
      fs.writeFileSync(pathToSave, outputHtml, 'utf-8')
    } catch (e) {
      inkdrop.notifications.addError('Failed to save HTML', {
        detail: e.message,
        dismissable: true
      })
    }
  },

  async copyNoteAsHtml(note) {
    const html = await this.generateHtml(note, {
      createHTMLOptions: {
        addTitle: false
      }
    })
    clipboard.writeHTML(html)
  },

  async generateHtml(note, opts = {}) {
    const exportUtils = require('inkdrop-export-utils')
    const { pathToSave, createHTMLOptions } = opts
      let markdown = note.body

    if (typeof pathToSave === 'string' && pathToSave.length > 0) {
      const dirToSave = path.dirname(pathToSave)
      markdown = await exportUtils.replaceImages(markdown, dirToSave, dirToSave)
    }

    const outputHtml = await exportUtils.createHTML({
      ...note,
      body: markdown
    }, createHTMLOptions)

    return outputHtml
  },

  deactivate() {
    this.subscription.dispose()
  }
}
