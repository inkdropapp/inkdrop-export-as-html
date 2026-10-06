const { logger, exportUtils } = require('inkdrop')
const path = require('path')
const fs = require('fs')
const { Note } = require('inkdrop').models

module.exports = {
  exportMultipleNotesAsHtml,
  exportNoteAsHtml,
  copyNoteAsHtml,
  copyNoteAsSimpleHtml,
  exportNotesInBook
}

async function exportMultipleNotesAsHtml(env, noteIds) {
  const { filePaths: res } = await env.dialog.showOpenDialog({
    title: 'Select Destination Directory',
    properties: ['openDirectory']
  })
  if (res instanceof Array && res.length > 0) {
    const destDir = res[0]

    try {
      for (let noteId of noteIds) {
        const note = await Note.loadWithId(noteId)
        if (note) {
          const fileName = exportUtils.sanitizeFileName(note.title, {
            extension: '.html'
          })
          await exportUtils.exportNoteAsHtml(note, destDir, fileName)
        }
      }
    } catch (e) {
      logger.error('Failed to export notes:', e)
      env.notifications.addError('Failed to export notes', {
        detail: e.message,
        dismissable: true
      })
    }
  }
}

async function exportNoteAsHtml(env, note, pathToSave) {
  if (typeof pathToSave !== 'string') {
    const res = await env.dialog.showSaveDialog({
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
      env.notifications.addError('Failed to save as HTML', {
        detail: e.message,
        dismissable: true
      })
    }
  }
}

async function copyNoteAsHtml(env, note) {
  try {
    const processor = await exportUtils.getProcessorForNote(note)
    if (!processor) return false

    await processor.replaceAttachmentImagesWithDataURI()
    const html = await processor.createHTMLWithTemplate(note.title)
    env.clipboard.write({ html, text: html })
  } catch (e) {
    logger.error('Failed to copy as html:', e)
    env.notifications.addError('Failed to copy as html', {
      detail: e.message,
      dismissable: true
    })
  }
}

async function copyNoteAsSimpleHtml(env, note) {
  try {
    const processor = await exportUtils.getProcessorForNote(note)
    if (!processor) return false

    await processor.replaceAttachmentImagesWithDataURI()
    const html = await processor.stringifySimple()
    env.clipboard.write({ html, text: html })
  } catch (e) {
    logger.error('Failed to copy as simple html:', e)
    env.notifications.addError('Failed to copy as simple html', {
      detail: e.message,
      dismissable: true
    })
  }
}

async function exportNotesInBook(env, bookId) {
  const book = findNoteFromTree(bookId, env.store.getState().books.tree)
  if (!book) {
    throw new Error('Notebook not found: ' + bookId)
  }
  const { filePaths: pathArrayToSave } = await env.dialog.showOpenDialog({
    title: `Select a directory to export a book "${book.name}"`,
    properties: ['openDirectory', 'createDirectory']
  })
  if (pathArrayToSave instanceof Array && pathArrayToSave.length > 0) {
    const [pathToSave] = pathArrayToSave
    try {
      await exportBook(env, pathToSave, book, { createBookDir: false })
      env.notifications.addInfo(
        `Finished exporting notes in "${book.name}"`,
        {
          detail: 'Directory: ' + pathToSave,
          dismissable: true
        }
      )
    } catch (e) {
      logger.error('Failed to export:', e)
      env.notifications.addError('Failed to export', {
        detail: e.message,
        dismissable: true
      })
    }
  }
}

async function exportBook(env, parentDir, book, opts = {}) {
  const { createBookDir = true } = opts
  const db = env.localDB
  const dirName = exportUtils.sanitizeFileName(book.name, { replacement: '-' })
  const pathToSave = createBookDir ? path.join(parentDir, dirName) : parentDir
  const { rows } = await db.notes.query(
    {
      index: 'notes',
      bookId: book._id,
      status: ['none', 'active', 'onHold', 'completed', 'dropped'],
      limit: false
    },
    { includeDocs: true }
  )
  const notes = rows.map(row => row.doc)

  !fs.existsSync(pathToSave) && fs.mkdirSync(pathToSave)
  for (let i = 0; i < notes.length; ++i) {
    await exportUtils.exportNoteAsHtml(notes[i], pathToSave)
  }

  if (book.children) {
    await book.children.reduce((promise, childBook) => {
      return promise.then(() => exportBook(env, pathToSave, childBook))
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
