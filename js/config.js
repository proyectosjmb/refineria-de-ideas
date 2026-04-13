/*
  Configuración central y catálogos de opciones de la app.
  Se mantiene aquí para compartirlos entre storage, render y handlers.
*/

export const STORAGE_KEY = "refineria-ideas-v1";
export const PERSISTENCE_MODES = {
  local: {
    id: "local",
    label: "Local",
    helpText: "Lee y guarda solo en este navegador.",
  },
  dual: {
    id: "dual",
    label: "Dual",
    helpText: "Mantiene respaldo local y sincroniza la base y la capa operativa en Firestore.",
  },
  remote: {
    id: "remote",
    label: "Remoto",
    helpText: "Toma la base y la capa operativa desde Firestore al cargar.",
  },
};
export const MAX_ACTIVE_PROJECTS = 3;
export const MAX_ACTIVE_PRIORITIES = 3;
export const MAX_ACTIVE_FOCUS_BLOCKS = 2;
export const DEFAULT_COPILOT_TYPE = "cohete";
export const DEFAULT_COPILOT_PHRASE = "Hoy, solo avanza.";

export const COPILOT_OPTIONS = [
  {
    id: "cohete",
    name: "Cohete",
    src: "assets/copilots/cohete.svg",
    alt: "Copiloto cohete",
  },
  {
    id: "sabio",
    name: "Sabio",
    src: "assets/copilots/sabio.svg",
    alt: "Copiloto sabio",
  },
];

export const OPERATION_MODES = {
  supervivencia: {
    label: "Supervivencia",
    description: "Proteger lo esencial",
    message: "Hoy el objetivo es proteger lo esencial, no abarcar todo.",
    focus: [
      "Acción clave al frente",
      "Jefe actual visible",
      "Minimo necesario, sin sobrecarga",
    ],
  },
  operacion: {
    label: "Operación",
    description: "Cumplir lo importante",
    message: "Hoy el objetivo es cumplir lo importante con estabilidad.",
    focus: [
      "Operación equilibrada",
      "Prioridades y bloques en balance",
      "Ritmo estable sin presión extra",
    ],
  },
  avance: {
    label: "Avance",
    description: "Empujar estratégicamente",
    message: "Hoy el objetivo es mover la aguja y empujar estratégicamente.",
    focus: [
      "Proyectos activos primero",
      "Foco semanal al centro",
      "Bloques de enfoque con empuje",
    ],
  },
};

export const PROBLEM_PRESET_OPTIONS = [
  "falta de claridad",
  "falta de estructura",
  "falta de guia",
  "falta de seguimiento",
  "falta de practica",
  "falta de enfoque",
  "falta de organizacion",
  "falta de consistencia",
  "saturacion",
  "necesidad de aprendizaje",
  "necesidad de acompanamiento",
  "mejora de desempeno",
  "otro",
];

export const PURPOSE_PRESET_OPTIONS = [
  "aclarar",
  "organizar",
  "ejecutar",
  "aprender",
  "guiar",
  "acompanar",
  "practicar",
  "desarrollar una habilidad",
  "dar seguimiento",
  "estructurar un proceso",
  "mejorar desempeno",
  "tomar decisiones",
  "otro",
];

export const AREA_PRESET_OPTIONS = [
  "trabajo",
  "negocio",
  "dinero",
  "personal",
  "familia",
  "crianza",
  "aprendizaje",
  "habilidades",
  "salud",
  "casa",
  "relaciones",
  "sistema general",
  "otro",
];

export const TIMING_PRESET_OPTIONS = [
  "hoy",
  "esta semana",
  "este mes",
  "cuando se necesite",
  "de forma continua",
  "por etapas",
  "practica recurrente",
  "sistema general",
  "despues",
  "incubadora",
  "otro",
];

export const LEGACY_PROBLEM_MAP = {
  dispersion: "falta de enfoque",
  "saturacion mental": "saturacion",
  "falta de prioridad": "falta de claridad",
  desorden: "falta de organizacion",
  procrastinacion: "falta de consistencia",
  "falta de seguimiento": "falta de seguimiento",
  "falta de enfoque": "falta de enfoque",
};

export const LEGACY_PURPOSE_MAP = {
  "aclarar direccion": "aclarar",
  "decidir prioridades": "tomar decisiones",
  "ejecutar mejor": "ejecutar",
  "organizar informacion": "organizar",
  "mejorar el sistema": "estructurar un proceso",
  "medir avance": "dar seguimiento",
};

export const REVIEW_CONFIG = {
  daily: {
    label: "Diaria",
    questionOne: "¿Qué sí avancé hoy?",
    questionTwo: "¿Qué me frenó?",
    questionThree: "¿Qué es lo más importante mañana?",
    placeholderOne: "Lo que sí se movió hoy",
    placeholderTwo: "Lo que generó fricción",
    placeholderThree: "Lo siguiente más importante",
  },
  weekly: {
    label: "Semanal",
    questionOne: "¿Qué sí movió la aguja esta semana?",
    questionTwo: "¿Qué fue ruido?",
    questionThree: "¿Qué sigue la próxima semana?",
    placeholderOne: "Lo que realmente movió avance",
    placeholderTwo: "Lo que consumió energía sin empujar resultados",
    placeholderThree: "Lo que sigue con más sentido la próxima semana",
  },
  monthly: {
    label: "Mensual",
    questionOne: "¿Qué mejoró este mes?",
    questionTwo: "¿Qué se estancó?",
    questionThree: "¿Qué debo ajustar en el sistema?",
    placeholderOne: "Lo que sí mejoró este mes",
    placeholderTwo: "Lo que no avanzó o se trabó",
    placeholderThree: "El ajuste más importante para el sistema",
  },
};
