import { Modal, Notice, Setting, TFile, setIcon } from 'obsidian'
import type { App } from 'obsidian'
import { ROUTINE_CATEGORIES, ROUTINE_TEMPLATES, type RoutineTemplate } from '../templates/routine-templates'
import { importRoutineTemplate } from '../templates/template-importer'

export class RoutineGalleryModal extends Modal {
  private searchQuery = ''
  private selectedCategory = 'All'
  private expandedTemplateId: string | null = null
  private listContainerEl!: HTMLElement

  constructor(app: App) {
    super(app)
  }

  onOpen(): void {
    this.modalEl.addClass('routine-gallery-modal')
    this.setTitle('Routine template gallery')

    this.renderHeaderControls()
    this.listContainerEl = this.contentEl.createDiv({ cls: 'routine-gallery-list' })
    this.renderTemplateList()
  }

  onClose(): void {
    this.contentEl.empty()
  }

  private renderHeaderControls(): void {
    const searchSection = this.contentEl.createDiv({ cls: 'routine-gallery-search-section' })

    const searchSetting = new Setting(searchSection)
      .setClass('routine-gallery-search-bar')
      .addText((text) => {
        text
          .setPlaceholder('Search routine templates…')
          .onChange((value) => {
            this.searchQuery = value.trim().toLowerCase()
            this.renderTemplateList()
          })
      })

    // Category filter pills
    const categoryBar = searchSection.createDiv({ cls: 'routine-gallery-category-bar' })
    for (const category of ROUTINE_CATEGORIES) {
      const pill = categoryBar.createEl('button', {
        cls: 'routine-gallery-category-pill',
        text: category,
      })
      if (category === this.selectedCategory) {
        pill.addClass('is-active')
      }
      pill.addEventListener('click', () => {
        this.selectedCategory = category
        this.updateCategoryPillStyles(categoryBar)
        this.renderTemplateList()
      })
    }

    // Suppress unused searchSetting warning by voiding it
    void searchSetting
  }

  private updateCategoryPillStyles(categoryBar: HTMLElement): void {
    const buttons = categoryBar.querySelectorAll('.routine-gallery-category-pill')
    buttons.forEach((button) => {
      if (button.textContent === this.selectedCategory) {
        button.classList.add('is-active')
      }
      else {
        button.classList.remove('is-active')
      }
    })
  }

  private getFilteredTemplates(): readonly RoutineTemplate[] {
    return ROUTINE_TEMPLATES.filter((template) => {
      const matchesCategory = this.selectedCategory === 'All' || template.category === this.selectedCategory
      if (!matchesCategory) {
        return false
      }

      if (!this.searchQuery) {
        return true
      }

      const query = this.searchQuery
      return (
        template.name.toLowerCase().includes(query)
        || template.description.toLowerCase().includes(query)
        || template.phaseSummary.toLowerCase().includes(query)
        || template.category.toLowerCase().includes(query)
      )
    })
  }

  private renderTemplateList(): void {
    this.listContainerEl.empty()

    const templates = this.getFilteredTemplates()
    if (templates.length === 0) {
      const emptyEl = this.listContainerEl.createDiv({ cls: 'routine-gallery-empty' })
      const iconEl = emptyEl.createSpan({ cls: 'routine-state-icon' })
      for (const name of ['inbox', 'list-x']) {
        setIcon(iconEl, name)
        if (iconEl.childElementCount > 0) {
          break
        }
      }
      emptyEl.createEl('p', { text: 'No matching routine templates found.' })
      return
    }

    const gridEl = this.listContainerEl.createDiv({ cls: 'routine-gallery-grid' })
    for (const template of templates) {
      this.renderTemplateCard(gridEl, template)
    }
  }

  private renderTemplateCard(parent: HTMLElement, template: RoutineTemplate): void {
    const cardEl = parent.createDiv({ cls: 'routine-gallery-card' })

    const headerEl = cardEl.createDiv({ cls: 'routine-gallery-card-header' })
    headerEl.createEl('h4', { text: template.name, cls: 'routine-gallery-card-title' })
    headerEl.createSpan({ text: template.category, cls: 'routine-template-category-badge' })

    cardEl.createEl('p', { text: template.description, cls: 'routine-template-desc' })

    const phaseRow = cardEl.createDiv({ cls: 'routine-template-phases' })
    const phaseIcon = phaseRow.createSpan({ cls: 'routine-state-icon' })
    for (const name of ['route', 'milestone', 'list-ordered']) {
      setIcon(phaseIcon, name)
      if (phaseIcon.childElementCount > 0) {
        break
      }
    }
    phaseRow.createSpan({ text: template.phaseSummary, cls: 'routine-template-phases-text' })

    const isExpanded = this.expandedTemplateId === template.id
    if (isExpanded) {
      const previewEl = cardEl.createDiv({ cls: 'routine-template-preview' })
      previewEl.createEl('pre', { text: template.markdownContent })
    }

    const actionsEl = cardEl.createDiv({ cls: 'routine-gallery-card-actions' })

    const previewBtn = actionsEl.createEl('button', {
      cls: 'routine-gallery-preview-btn',
      text: isExpanded ? 'Hide preview' : 'Preview',
    })
    previewBtn.addEventListener('click', () => {
      this.expandedTemplateId = isExpanded ? null : template.id
      this.renderTemplateList()
    })

    const importBtn = actionsEl.createEl('button', {
      cls: 'mod-cta routine-gallery-import-btn',
      text: 'Import routine',
    })
    importBtn.addEventListener('click', () => {
      void this.handleImport(template)
    })
  }

  private async handleImport(template: RoutineTemplate): Promise<void> {
    const result = await importRoutineTemplate(this.app.vault, template)
    if (result.success) {
      new Notice(`Routine Flow: imported "${template.name}" as "${result.path}"`)
      const file = this.app.vault.getAbstractFileByPath(result.path)
      if (file instanceof TFile) {
        await this.app.workspace.getLeaf(false).openFile(file)
      }
      this.close()
    }
    else {
      new Notice(`Routine Flow: ${result.error ?? 'import failed'}`)
    }
  }
}
