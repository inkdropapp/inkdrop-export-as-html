import { remote } from 'electron'
import path from 'path'
import fs from 'fs'
const { dialog } = remote

module.exports = {
  activate () {
    this.subscription = inkdrop.commands.add(document.body, {
      'export-as-html:export': () => this.exportAsHTML()
    })
  },

  exportAsHTML () {
    const templateFilePath = path.join(__dirname, 'template.html')
    const templateHtml = fs.readFileSync(templateFilePath, 'utf-8')
    const { MDEPreview } = inkdrop.components.classes
    const { document } = inkdrop.flux.getStore('note').getState()
    if (document) {
      const markdown = `# ${document.title}\n${document.body}`
      const htmlBody = MDEPreview.renderer.render(markdown)
      const outputHtml = templateHtml.replace('{%body%}', htmlBody)

      const pathToSave = dialog.showSaveDialog({
        title: 'Save HTML file',
        defaultPath: `${document.title}.html`,
        filters: [
          { name: 'HTML Files', extensions: [ 'html' ] },
          { name: 'All Files', extensions: [ '*' ] }
        ]
      })

      if (pathToSave) {
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
