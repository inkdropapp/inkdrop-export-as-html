const remote = require('@electron/remote')
const { clipboard } = require('electron')
const { logger, exportUtils } = require('inkdrop')
const path = require('path')
const sanitize = require('sanitize-filename')
const fs = require('fs')
const { Note } = require('inkdrop').models
const dialog = remote.dialog

module.exports = {
  exportMultipleNotesAsHtml,
  exportNoteAsHtml,
  copyNoteAsHtml,
  copyNoteAsSimpleHtml,
  exportNotesInBook
}

async function exportMultipleNotesAsHtml(noteIds) {
  const { filePaths: res } = await dialog.showOpenDialog(inkdrop.window, {
    title: 'Select Destination Directory',
    properties: ['openDirectory']
  })
  if (res instanceof Array && res.length > 0) {
    const destDir = res[0]

    for (let noteId of noteIds) {
      const note = await Note.loadWithId(noteId)
      if (note) {
        const fileName = `${note.title}.html`
        await exportUtils.exportNoteAsHtml(note, destDir, fileName)
      }
    }
  }
}

async function exportNoteAsHtml(note, pathToSave) {
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

  if (pathToSave) {
    try {
      const destDir = path.dirname(pathToSave)
      const fileName = path.basename(pathToSave)
      await exportUtils.exportNoteAsHtml(note, destDir, fileName)
    } catch (e) {
      logger.error('Failed to save HTML:', e)
      inkdrop.notifications.addError('Failed to save as HTML', {
        detail: e.message,
        dismissable: true
      })
    }
  }
}

async function copyNoteAsHtml(note) {
  try {
    const processor = await exportUtils.getProcessorForNote(note)
    if (!processor) return false

    await processor.replaceAttachmentImagesWithDataURI()
    const html = await processor.createHTMLWithTemplate(note.title)
    clipboard.write({ html, text: html })
  } catch (e) {
    logger.error('Failed to copy as html:', e)
    inkdrop.notifications.addError('Failed to copy as html', {
      detail: e.message,
      dismissable: true
    })
  }
}

async function copyNoteAsSimpleHtml(note) {
  try {
    const processor = await exportUtils.getProcessorForNote(note)
    if (!processor) return false

    await processor.replaceAttachmentImagesWithDataURI()
    const html = await processor.stringifySimple()
    clipboard.write({ html, text: html })
  } catch (e) {
    logger.error('Failed to copy as simple html:', e)
    inkdrop.notifications.addError('Failed to copy as simple html', {
      detail: e.message,
      dismissable: true
    })
  }
}

async function exportNotesInBook(bookId) {
  const book = findNoteFromTree(bookId, inkdrop.store.getState().books.tree)
  if (!book) {
    throw new Error('Notebook not found: ' + bookId)
  }
  const { filePaths: pathArrayToSave } = await dialog.showOpenDialog({
    title: `Select a directory to export a book "${book.name}"`,
    properties: ['openDirectory', 'createDirectory']
  })
  if (pathArrayToSave instanceof Array && pathArrayToSave.length > 0) {
    const [pathToSave] = pathArrayToSave
    try {
      await exportBook(pathToSave, book, { createBookDir: false })
      inkdrop.notifications.addInfo(
        `Finished exporting notes in "${book.name}"`,
        {
          detail: 'Directory: ' + pathToSave,
          dismissable: true
        }
      )
    } catch (e) {
      logger.error('Failed to export:', e)
      inkdrop.notifications.addError('Failed to export', {
        detail: e.message,
        dismissable: true
      })
    }
  }
}

async function exportBook(parentDir, book, opts = {}) {
  const { createBookDir = true } = opts
  const db = inkdrop.main.dataStore.getLocalDB()
  const dirName = sanitize(book.name, { replacement: '-' })
  const pathToSave = createBookDir ? path.join(parentDir, dirName) : parentDir
  const { docs: notes } = await db.notes.findInBook(book._id, {
    limit: false
  })

  !fs.existsSync(pathToSave) && fs.mkdirSync(pathToSave)
  for (let i = 0; i < notes.length; ++i) {
    await exportUtils.exportNoteAsHtml(notes[i], pathToSave)
  }

  if (book.children) {
    await book.children.reduce((promise, childBook) => {
      return promise.then(() => exportBook(pathToSave, childBook))
    }, Promise.resolve())
  }
}

function findNoteFromTree(bookId, tree) {
  for (let i = 0; i < tree.length; ++i) {
    const item = tree[i]
    if (item._id === bookId) {
      return item
    } else if (item.children) {
      const book = findNoteFromTree(bookId, item.children)
      if (book) {
        return book
      }
    }
  }
  return undefined
}
