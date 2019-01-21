const remote = require('electron').remote
const path = require('path')
const fs = require('fs')
const dialog = remote.dialog

module.exports = {
  activate () {
    this.subscription = inkdrop.commands.add(document.body, {
      'export-as-html:export': () => this.exportAsHTML()
    })
  },

  async exportAsHTML () {
    const exportUtils = require('inkdrop-export-utils')
    const templateFilePath = require.resolve(path.join('inkdrop-export-utils', 'assets', 'template.html'))
    const templateHtml = fs.readFileSync(templateFilePath, 'utf-8')
    const { document } = inkdrop.flux.getStore('editor').getState()
    if (document) {
      const pathToSave = dialog.showSaveDialog({
        title: 'Save HTML file',
        defaultPath: `${document.title}.html`,
        filters: [
          { name: 'HTML Files', extensions: [ 'html' ] },
          { name: 'All Files', extensions: [ '*' ] }
        ]
      })

      if (typeof pathToSave === 'string') {
        let markdown = `# ${document.title}\n${document.body}`
        markdown = await exportUtils.replaceImages(markdown, path.dirname(pathToSave))
        const htmlBody = await exportUtils.renderHTML(markdown)
        const htmlStyles = exportUtils.getStylesheets()
        const outputHtml = templateHtml
          .replace('{%body%}', htmlBody)
          .replace('{%styles%}', htmlStyles)
          .replace('{%title%}', document.title)

        try {
          fs.writeFileSync(pathToSave, outputHtml, 'utf-8')
        } catch (e) {
          inkdrop.notifications.addError('Failed to save HTML', e.stack)
        }
      }
    } else {
      inkdrop.notifications.addError('No note opened', { detail: 'Please open a note to export as HTML', dismissable: true })
    }
  },

  deactivate () {
    this.subscription.dispose()
  }
}
