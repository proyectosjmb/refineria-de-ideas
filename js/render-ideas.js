/*
  Render del inbox y de las salidas operativas.
*/

import { MAX_ACTIVE_PROJECTS } from "./config.js";
import { elements } from "./dom.js";
import {
  canAddAnotherActiveProject,
  getIdeaCountsByStatus,
  getIdeasSorted,
  getOutputsSorted,
  getProjectFromOutput,
  getVisibleIdeas,
} from "./state.js";
import {
  escapeHtml,
  formatCatalogLabel,
  formatDate,
  formatProjectStateLabel,
} from "./utils.js";

export function syncIdeaFilterState(activeIdeaFilter, ideaSearchText, statusFilterButtons) {
  statusFilterButtons.forEach((button) => {
    const isActive = button.dataset.filter === activeIdeaFilter;
    button.classList.toggle("is-active", isActive);
  });

  if (elements.ideaSearchField.value !== ideaSearchText) {
    elements.ideaSearchField.value = ideaSearchText;
  }
}

export function renderInboxFilters(activeIdeaFilter, ideaSearchText, statusFilterButtons) {
  const counts = getIdeaCountsByStatus();

  elements.countAll.textContent = counts.todas;
  elements.countPending.textContent = counts.pendiente;
  elements.countProcessed.textContent = counts.procesada;
  elements.countArchived.textContent = counts.archivada;
  syncIdeaFilterState(activeIdeaFilter, ideaSearchText, statusFilterButtons);
}

export function renderIdeas() {
  const allIdeas = getIdeasSorted();
  const visibleIdeas = getVisibleIdeas();

  if (allIdeas.length === 0) {
    elements.ideasList.innerHTML = `
      <article class="empty-state">
        <h3>Tu inbox está vacío</h3>
        <p>
          Captura una primera idea para arrancar el flujo.
          Aquí aparecerán las ideas pendientes, procesadas y archivadas.
        </p>
      </article>
    `;
    return;
  }

  if (visibleIdeas.length === 0) {
    elements.ideasList.innerHTML = `
      <article class="empty-state">
        <h3>No hay coincidencias</h3>
        <p>
          Ajusta el filtro o el texto de busqueda para volver a ver ideas del inbox.
        </p>
      </article>
    `;
    return;
  }

  elements.ideasList.innerHTML = visibleIdeas
    .map((idea) => {
      const sourceText = idea.source ? escapeHtml(idea.source) : "Sin fuente";
      const noteText = idea.note
        ? `<p class="idea-note">${escapeHtml(idea.note)}</p>`
        : `<p class="idea-note">Sin nota breve.</p>`;
      const isArchived = idea.status === "archivada";

      return `
        <article class="idea-card">
          <div class="idea-card-zone idea-card-title-zone">
            <div class="idea-header">
              <div class="idea-summary">
                <h3 class="idea-title">${escapeHtml(idea.title)}</h3>
              </div>
              <span class="status-badge status-${escapeHtml(idea.status)}">${escapeHtml(idea.status)}</span>
            </div>
          </div>

          <div class="idea-card-zone idea-card-description-zone">
            <div class="idea-note-wrap">
              ${noteText}
            </div>
          </div>

          <div class="idea-card-zone idea-card-meta-zone idea-meta">
            <div class="idea-meta-row">
              <span class="meta-chip"><strong>Fuente</strong> ${sourceText}</span>
              <span class="meta-chip"><strong>Fecha</strong> ${escapeHtml(formatDate(idea.createdAt))}</span>
            </div>
            <div class="idea-meta-row">
              <span class="meta-chip"><strong>Estado</strong> ${escapeHtml(idea.status)}</span>
            </div>
          </div>

          <div class="card-actions idea-actions idea-card-zone idea-card-actions-zone">
            <button
              class="action-button action-button-secondary"
              type="button"
              data-action="details"
              data-id="${idea.id}"
            >
              Ver detalles
            </button>
            <button
              class="action-button action-button-primary"
              type="button"
              data-action="process"
              data-id="${idea.id}"
              ${isArchived ? "disabled" : ""}
            >
              Procesar
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

export function renderOutputs() {
  const outputs = getOutputsSorted();

  if (outputs.length === 0) {
    elements.outputsList.innerHTML = `
      <article class="empty-state">
        <h3>Aún no hay salidas operativas</h3>
        <p>
          Cuando proceses una idea, aquí aparecerá una salida clara y lista para usarse.
        </p>
      </article>
    `;
    return;
  }

  elements.outputsList.innerHTML = outputs
    .map((output) => {
      const executionActions = [];
      const linkedProject = getProjectFromOutput(output.id);

      if (output.outputType === "accion") {
        executionActions.push(`
          <button
            class="output-action-button"
            type="button"
            data-output-action="send-today"
            data-output-id="${output.id}"
          >
            Enviar a hoy
          </button>
        `);
      }

      if (output.outputType === "proyecto") {
        if (linkedProject) {
          const projectStateLabel =
            linkedProject.status === "activo"
              ? "Proyecto activado"
              : formatProjectStateLabel(linkedProject.status);
          const projectStateNote =
            linkedProject.status === "activo"
              ? "Ya entró en ejecución real y vive en Proyectos activos."
              : linkedProject.status === "pausa"
                ? "Ya fue activado y hoy esta en pausa."
                : "Ya fue activado y quedo marcado como completado.";

          executionActions.push(`
            <div class="output-action-stack">
              <button
                class="output-action-button output-action-button-state"
                type="button"
                disabled
                aria-disabled="true"
              >
                ${projectStateLabel}
              </button>
              <span class="output-action-note">${projectStateNote}</span>
            </div>
          `);
        } else if (!canAddAnotherActiveProject()) {
          executionActions.push(`
            <div class="output-action-stack">
              <button
                class="output-action-button output-action-button-disabled"
                type="button"
                disabled
                aria-disabled="true"
              >
                Activación bloqueada
              </button>
              <span class="output-action-note">Ya tienes ${MAX_ACTIVE_PROJECTS} proyectos activos. Pausa o completa uno antes de activar otro.</span>
            </div>
          `);
        } else {
          executionActions.push(`
            <button
              class="output-action-button"
              type="button"
              data-output-action="activate-project"
              data-output-id="${output.id}"
            >
              Activar proyecto
            </button>
          `);
        }
      }

      executionActions.push(`
        <button
          class="output-action-button"
          type="button"
          data-output-action="edit"
          data-output-id="${output.id}"
        >
          Editar
        </button>
      `);

      return `
        <article class="output-card">
          <h3>${escapeHtml(output.ideaTitle)}</h3>

          <div class="output-topline">
            <span class="output-badge output-badge-accent">
              <strong>Tipo</strong> ${escapeHtml(formatCatalogLabel(output.outputType))}
            </span>
            <span class="output-badge">
              <strong>Área</strong> ${escapeHtml(output.area)}
            </span>
            <span class="output-badge">
              <strong>Cuando aplica</strong> ${escapeHtml(output.timing)}
            </span>
          </div>

          <div class="output-layout">
            <div class="output-summary">
              <div class="output-summary-card">
                <span class="output-label">Necesidad o fricción</span>
                <p>${escapeHtml(output.problem)}</p>
              </div>
              <div class="output-summary-card">
                <span class="output-label">Para qué sirve</span>
                <p>${escapeHtml(output.purpose)}</p>
              </div>
            </div>

            <div class="output-side">
              <div class="output-side-card output-minimum">
                <span class="output-label">Versión mínima lista para usar</span>
                <p>${escapeHtml(output.minimumVersion)}</p>
              </div>
            </div>
          </div>

          <div class="output-card-actions">
            ${executionActions.join("")}
          </div>
        </article>
      `;
    })
    .join("");
}
