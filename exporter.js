const { remote, clipboard } = require('electron')
const { logger } = require('inkdrop')
const path = require('path')
const sanitize = require('sanitize-filename')
const fs = require('fs')
const touch = require('touch')
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
  const { notes } = inkdrop.store.getState()
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
        await exportNote(note, destDir, fileName)
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
      await exportNote(note, destDir, fileName)
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
  const { replaceHTMLImagesWithDataURI } = require('inkdrop-export-utils')
  try {
    let html = await generateHtml(note, {
      createHTMLOptions: { addTitle: false }
    })
    html = await replaceHTMLImagesWithDataURI(html)
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
  const { replaceHTMLImagesWithDataURI } = require('inkdrop-export-utils')
  try {
    let html = await generateSimpleHtml(note)
    html = await replaceHTMLImagesWithDataURI(html)
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
  if (pathArrayToSave) {
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
    await exportNote(notes[i], pathToSave)
  }

  if (book.children) {
    await book.children.reduce((promise, childBook) => {
      return promise.then(() => exportBook(pathToSave, childBook))
    }, Promise.resolve())
  }
}

async function exportNote(note, pathToSave, fileName) {
  if (note.body) {
    const datestr = new Date(note.createdAt)
      .toISOString()
      .split('T')[0]
      .replace(/-/g, '')
    fileName =
      fileName ||
      sanitize(datestr + '-' + note.title + '-' + note._id.substr(5)) + '.html'
    const filePath = path.join(pathToSave, fileName)
    const outputHtml = await generateHtml(note, { pathToSave })

    fs.writeFileSync(filePath, outputHtml, 'utf-8')
    touch.sync(filePath, { time: new Date(note.updatedAt) })
  }
}

async function generateHtml(note, opts = {}) {
  const exportUtils = require('inkdrop-export-utils')
  const { pathToSave, createHTMLOptions } = opts
    let markdown = note.body

  if (typeof pathToSave === 'string' && pathToSave.length > 0) {
    markdown = await exportUtils.replaceImages(markdown, pathToSave, pathToSave)
  }

  const outputHtml = await exportUtils.createHTML({
    ...note,
    body: markdown
  }, createHTMLOptions)

  return outputHtml
}

async function generateSimpleHtml(note, opts = {}) {
  const exportUtils = require('inkdrop-export-utils')
  const { pathToSave, createHTMLOptions } = opts
  const remark = require('unified')()
    .use(require('remark-parse'))
    .use(require('remark-frontmatter'))
    .use(require('remark-rehype'))
    .use(require('rehype-format'))
    .use(require('rehype-stringify'))
  const result = await remark.process(note.body)

  return result.contents
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
