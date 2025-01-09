import { commands, window, workspace } from 'vscode'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { Commands } from './commands'
import { ExtensionModule } from '~/modules'
import { usage, DeeplGlossaries } from '~/translators/engines/deepl'
import i18n from '~/i18n'
import { Config } from '~/core'
import { abbreviateNumber } from '~/utils'

async function deepAuth() {
  const apiKey = Config.deeplApiKey

  if (!apiKey) {
    return window.showErrorMessage(
      i18n.t('prompt.deepl_api_key_required'),
    )
  }

  try {
    const deeplUsage = await usage()

    window.showInformationMessage(
      i18n.t(
        'prompt.deepl_usage',
        abbreviateNumber(deeplUsage.character_count),
        abbreviateNumber(deeplUsage.character_limit),
      ),
      i18n.t('prompt.button_discard'),
    )
  }
  catch (err) {
    window.showErrorMessage(i18n.t('prompt.deepl_error_get_usage'))
  }
}


type GlossaryFile = {
  path: string,
  sourceLanguage: string,
  targetLanguage: string,
  name: string,
}

const GLOSSARY_FILE_REGEX = /(\w{2,3})-(\w{2,3}).csv/

class DeeplGlossaryCommands {

  private static glossaries = new DeeplGlossaries()

  public static async updateGlossary() {
    try {
      this.checkEnabled()

      const availableGlossaryFiles = this.getAvailableGlossaryFiles(),
        fileNames = availableGlossaryFiles.map(({ name }) => name),
        chosenFileName = await window.showQuickPick(fileNames, { canPickMany: false })

      if (! chosenFileName) {
        return
      }

      const chosenFile = availableGlossaryFiles.find(({ name }) => name === chosenFileName)

      if (chosenFile) {
        await this.updateGlossaryFromFile(chosenFile)
      }
    } catch (error) {
      if (error instanceof Error) {
        window.showErrorMessage(error.message)
      } else {
        window.showErrorMessage(`Unkown error: "${error}"`)
      }
    }
  }

  public static async updateGlossaries() {
    try {
      this.checkEnabled()

      const availableGlossaryFiles = this.getAvailableGlossaryFiles()

      for (const glossaryFile of availableGlossaryFiles) {
        await this.updateGlossaryFromFile(glossaryFile)
      }
    } catch (error) {
      if (error instanceof Error) {
        window.showErrorMessage(error.message)
      } else {
        window.showErrorMessage(`Unkown error: "${error}"`)
      }
    }
  }

  public static async listGlossaries() {
    try {
      this.checkEnabled();

      const outputChannel = window.createOutputChannel('glossaries');

      outputChannel.show();
      outputChannel.appendLine('Reading glossary list...');

      const glossaries = await this.glossaries.readGlossaryList(true);

      outputChannel.appendLine(JSON.stringify(glossaries, null, '\t'));
    } catch (error) {
      if (error instanceof Error) {
        window.showErrorMessage(error.message)
      } else {
        window.showErrorMessage(`Unkown error: "${error}"`)
      }
    }

  }

  private static async updateGlossaryFromFile(file: GlossaryFile) {
    const glossaryContent = readFileSync(file.path, 'utf-8')

    await this.glossaries.updateGlossary(file.targetLanguage, file.sourceLanguage, glossaryContent)

    window.showInformationMessage(`Glossary "${file.name}" updated successfully.`)
  }

  private static getAvailableGlossaryFiles(): Array<GlossaryFile> {
    const glossaryPath = join(this.getWorkspacePath(), Config.deeplGlossariesDir!)

    return readdirSync(glossaryPath)
      .map(fileName => {
        const match = GLOSSARY_FILE_REGEX.exec(fileName)

        if (match) {
          return {
            path: join(glossaryPath, fileName),
            sourceLanguage : match[1],
            targetLanguage : match[2],
            name : fileName
          }
        }
      })
      .filter(glossary => !! glossary) as Array<GlossaryFile>
  }

  private static getWorkspacePath(): string {
    try {
      return workspace.workspaceFolders![0].uri.path
    } catch (error) {
      throw new Error('No workspace available')
    }
  }

  private static checkEnabled() {
    const isEnabled = this.glossaries.isEnabled()

    if (! isEnabled) {
      throw new Error('Glossaries are not configured')
    }
  }
}


export default <ExtensionModule> function() {
  return [
    commands.registerCommand(Commands.deepl_usage, deepAuth),
    commands.registerCommand(Commands.deepl_update_glossaries, DeeplGlossaryCommands.updateGlossaries.bind(DeeplGlossaryCommands)),
    commands.registerCommand(Commands.deepl_update_glossary, DeeplGlossaryCommands.updateGlossary.bind(DeeplGlossaryCommands)),
    commands.registerCommand(Commands.deepl_list_glossaries, DeeplGlossaryCommands.listGlossaries.bind(DeeplGlossaryCommands)),
  ]
}
