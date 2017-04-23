'use babel'
import { remote } from 'electron'
import path from 'path'
import fs from 'fs'
import html from 'remark-html'
import hljs from 'remark-highlight.js'
const { dialog } = remote

module.exports = {
  activate () {
    this.subscription = inkdrop.commands.add(document.body, {
      'export-as-html:export': () => this.exportAsHTML()
    })
  },

  async exportAsHTML () {
    const templateFilePath = path.join(__dirname, 'template.html')
    const templateHtml = fs.readFileSync(templateFilePath, 'utf-8')
    const { MDEPreview } = inkdrop.components.classes
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

      let markdown = `# ${document.title}\n${document.body}`
      markdown = await this.replaceImages(markdown, path.dirname(pathToSave))
      const processor = MDEPreview.getRemarkProcessor().use([ html, hljs ])
      const htmlBody = await processor.process(markdown)
      const outputHtml = templateHtml.replace('{%body%}', htmlBody)

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

  async replaceImages (body, dirToSave) {
    // find attachments
    const uris = body.match(/inkdrop:\/\/file:[^\) ]*/g) || []
    for (let i = 0; i < uris.length; ++i) {
      const uri = uris[i]
      const imagePath = await this.exportImage(uri, dirToSave)
      if (imagePath) {
        body = body.replace(uri, imagePath)
      }
    }
    return body
  },

  async exportImage (uri, dirToSave) {
    try {
      const file = await inkdrop.models.File.getDocumentFromUri(uri)
      return file.saveFileSync(dirToSave)
    } catch (e) {
      console.error('Failed to export image file:', e)
      return false
    }
  },

  deactivate () {
    this.subscription.dispose()
  }

}
