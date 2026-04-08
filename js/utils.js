/*
  Helpers puros reutilizables.
  No dependen del DOM ni mutan el estado global.
*/

import {
  LEGACY_PROBLEM_MAP,
  OPERATION_MODES,
} from "./config.js";

export function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatDate(dateString) {
  try {
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(dateString));
  } catch (error) {
    return dateString;
  }
}

export function formatShortDate(dateString) {
  if (!dateString) {
    return "";
  }

  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split("-").map(Number);
      return new Intl.DateTimeFormat("es-MX", {
        dateStyle: "medium",
      }).format(new Date(year, month - 1, day));
    }

    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
    }).format(new Date(dateString));
  } catch (error) {
    return dateString;
  }
}

export function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function parseMoneyAmount(value) {
  const parsedValue = Number.parseFloat(String(value || "").trim());
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

export function formatCurrency(amount = 0) {
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (error) {
    return `$${amount.toFixed(2)}`;
  }
}

export function getTodayDateValue() {
  return new Date().toISOString().slice(0, 10);
}

export function formatTimeRange(startTime = "", endTime = "") {
  if (startTime && endTime) {
    return `${startTime} - ${endTime}`;
  }

  if (startTime) {
    return `Desde ${startTime}`;
  }

  if (endTime) {
    return `Hasta ${endTime}`;
  }

  return "Horario libre";
}

export function getModeLabel(modeKey) {
  return OPERATION_MODES[modeKey]?.label || OPERATION_MODES.operacion.label;
}

export function formatProjectStateLabel(status = "") {
  const safeStatus = normalizeText(status);

  if (!safeStatus) {
    return "Proyecto vinculado";
  }

  if (safeStatus === "pausa" || safeStatus === "en pausa") {
    return "Proyecto en pausa";
  }

  if (safeStatus === "completado") {
    return "Proyecto completado";
  }

  return "Proyecto activo";
}

const DISPLAY_LABEL_MAP = {
  "accion": "Acción",
  "metrica": "Métrica",
  "falta de guia": "falta de guía",
  "falta de practica": "falta de práctica",
  "falta de organizacion": "falta de organización",
  "saturacion": "saturación",
  "necesidad de acompanamiento": "necesidad de acompañamiento",
  "mejora de desempeno": "mejora de desempeño",
  "acompanar": "acompañar",
  "practica recurrente": "práctica recurrente",
  "despues": "después",
};

export function formatCatalogLabel(value = "") {
  const safeValue = String(value || "").trim();

  if (!safeValue) {
    return "";
  }

  return DISPLAY_LABEL_MAP[normalizeText(safeValue)] || safeValue;
}

export function getSelectableFieldState(currentValue = "", presetOptions = [], legacyMap = LEGACY_PROBLEM_MAP) {
  const safeValue = String(currentValue || "").trim();

  if (!safeValue) {
    return {
      presetValue: "",
      customValue: "",
    };
  }

  if (presetOptions.includes(safeValue)) {
    return {
      presetValue: safeValue,
      customValue: "",
    };
  }

  if (legacyMap[safeValue]) {
    return {
      presetValue: legacyMap[safeValue],
      customValue: "",
    };
  }

  return {
    presetValue: "otro",
    customValue: safeValue,
  };
}

export function getResolvedSelectFieldValue(selectValue, customValue) {
  if (selectValue !== "otro") {
    return String(selectValue || "").trim();
  }

  return String(customValue || "").trim();
}
