import type { LegalContentMap } from '@/lib/legal/types'

import { getAppUrl } from '@/lib/env'

const COMPANY = 'Runlabs42'
const CONTACT = `${getAppUrl()}/contact`

export const esLegal: LegalContentMap = {
  privacy: {
    title: 'Política de privacidad',
    subtitle: 'Cómo recopilamos, usamos y protegemos sus datos personales.',
    lastUpdated: '18 de mayo de 2026',
    acceptanceNotice:
      `Al acceder o utilizar ${COMPANY}, confirma que ha leído y comprendido esta Política de privacidad y acepta sus términos. El servicio se presta dentro de los límites aquí descritos; salvo que la ley aplicable exija lo contrario, ${COMPANY} y sus operadores no asumirán responsabilidad más allá de los límites legalmente obligatorios.`,
    sections: [
      {
        id: 'controller',
        title: '1. Responsable del tratamiento',
        paragraphs: [
          `El responsable del tratamiento de los datos personales en relación con ${COMPANY} es la entidad que opera la plataforma (en adelante, «${COMPANY}» o «nosotros»).`,
          `Para solicitudes relacionadas con la privacidad, contáctenos en ${CONTACT} o en la dirección indicada en nuestro sitio web.`,
        ],
      },
      {
        id: 'scope',
        title: '2. Ámbito de aplicación',
        paragraphs: [
          'Esta política se aplica a los datos personales tratados cuando visita nuestro sitio, crea una cuenta (mediante OAuth de GitHub o Google), utiliza el editor, el marketplace, la facturación o contacta con soporte.',
          'No se aplica a sitios o servicios de terceros enlazados desde nuestra plataforma; estos se rigen por sus propias políticas.',
        ],
      },
      {
        id: 'data',
        title: '3. Datos que recopilamos',
        paragraphs: [
          'Datos de cuenta: nombre, correo electrónico, imagen de perfil e identificadores proporcionados por su proveedor OAuth (GitHub o Google).',
          'Datos de uso: proyectos, especificaciones, código generado, mensajes de chat, consumo de créditos, ajustes de integraciones y registros técnicos (dirección IP, navegador, marcas temporales) necesarios para seguridad y operación.',
          'Datos de pago: los eventos de facturación los procesa Stripe; no almacenamos números completos de tarjeta en nuestros servidores.',
          'Comunicaciones: información que envíe mediante formularios de contacto o canales de soporte.',
        ],
      },
      {
        id: 'bases',
        title: '4. Bases jurídicas (EEE/Reino Unido)',
        paragraphs: [
          'Ejecución del contrato: para prestar el servicio solicitado, incluida la gestión de la cuenta y el almacenamiento de proyectos.',
          'Interés legítimo: seguridad, prevención del fraude, mejora del servicio y analítica agregada, equilibrada con sus derechos.',
          'Consentimiento: cuando sea necesario para cookies no esenciales o comunicaciones comerciales opcionales.',
          'Obligación legal: cuando debamos conservar o comunicar datos para cumplir la ley.',
        ],
      },
      {
        id: 'use',
        title: '5. Uso de sus datos',
        paragraphs: [
          'Utilizamos los datos personales para operar la plataforma, autenticar usuarios, conservar proyectos, procesar solicitudes de IA, gestionar créditos y suscripciones, responder consultas y cumplir obligaciones legales.',
          'Las funciones de IA pueden enviar indicaciones y contexto del proyecto a proveedores de modelos (p. ej. Google Gemini) bajo sus condiciones; no envíe datos personales sensibles o ilícitos si no acepta ese riesgo.',
        ],
      },
      {
        id: 'processors',
        title: '6. Encargados y transferencias',
        paragraphs: [
          'Confiamos en subencargados de confianza, incluidos alojamiento y bases de datos (p. ej. Supabase), pagos (Stripe) e infraestructura de IA. Puede solicitarnos la lista actualizada.',
          'Los datos pueden tratarse en la Unión Europea, Estados Unidos u otros países donde operen nuestros proveedores. Cuando sea necesario, aplicamos garantías como las Cláusulas Contractuales Tipo.',
        ],
      },
      {
        id: 'retention',
        title: '7. Conservación',
        paragraphs: [
          'Conservamos los datos de cuenta y proyecto mientras su cuenta esté activa y durante un periodo razonable posterior para recuperación y cumplimiento legal.',
          'Los registros y datos de facturación se conservan durante los plazos exigidos por obligaciones fiscales, contables y de seguridad, y después se eliminan o anonimizan.',
        ],
      },
      {
        id: 'rights',
        title: '8. Sus derechos',
        paragraphs: [
          'Según su ubicación, puede tener derecho de acceso, rectificación, supresión, limitación, portabilidad u oposición al tratamiento, y a retirar el consentimiento cuando el tratamiento se base en él.',
          'Puede presentar una reclamación ante su autoridad de protección de datos. Para ejercer derechos, contáctenos; responderemos en los plazos legales aplicables.',
        ],
      },
      {
        id: 'security',
        title: '9. Seguridad',
        paragraphs: [
          'Aplicamos medidas técnicas y organizativas acordes al riesgo, incluido cifrado en tránsito, controles de acceso y separación de datos de clientes cuando proceda.',
          'Ningún método de transmisión o almacenamiento es totalmente seguro; utiliza el servicio bajo su propio riesgo respecto a accesos no autorizados más allá de nuestros controles razonables.',
        ],
      },
      {
        id: 'liability',
        title: '10. Limitación de responsabilidad',
        paragraphs: [
          `En la máxima medida permitida por la ley aplicable, ${COMPANY} no será responsable de daños indirectos, incidentales, especiales, consecuenciales o punitivos, ni de pérdida de beneficios, datos o fondo de comercio derivados del uso del servicio o de la divulgación de datos personales, salvo cuando dicha limitación esté prohibida.`,
          'Nada en esta política limita la responsabilidad por muerte o lesiones personales por negligencia, fraude u otras causas que no puedan excluirse legalmente.',
        ],
      },
      {
        id: 'changes',
        title: '11. Cambios',
        paragraphs: [
          'Podemos actualizar esta política periódicamente. La fecha «Última actualización» indica la versión vigente. Los cambios sustanciales podrán notificarse en el sitio o por correo cuando proceda.',
          'El uso continuado tras los cambios implica la aceptación de la política actualizada, salvo que la ley exija consentimiento explícito.',
        ],
      },
    ],
  },
  cookies: {
    title: 'Política de cookies',
    subtitle: 'Información sobre cookies y tecnologías similares en nuestro sitio.',
    lastUpdated: '18 de mayo de 2026',
    acceptanceNotice:
      `Al seguir navegando o utilizando ${COMPANY} tras ver el aviso de cookies, acepta esta Política de cookies y el uso descrito, salvo cookies no esenciales para las que solicitamos su consentimiento. No somos responsables de sitios o servicios de terceros fuera de nuestro control.`,
    sections: [
      {
        id: 'what',
        title: '1. ¿Qué son las cookies?',
        paragraphs: [
          'Las cookies son pequeños archivos de texto almacenados en su dispositivo al visitar un sitio web. Tecnologías similares incluyen almacenamiento local, de sesión y píxeles.',
          'Permiten que el sitio funcione, recuerde preferencias y comprenda cómo se utiliza el servicio.',
        ],
      },
      {
        id: 'types',
        title: '2. Cookies que utilizamos',
        paragraphs: [
          'Estrictamente necesarias: sesión de autenticación (Supabase), seguridad, equilibrio de carga y banderas de modo demo en desarrollo. Son imprescindibles para el funcionamiento.',
          'Preferencias: idioma (sk.lang), tema (sk.theme), diseño del editor, interruptor Spec-Kit y estado de consentimiento (sk.cookie_consent).',
          'Funcionales: pueden incluir cookies de estado OAuth durante flujos de integración con Vercel u otros.',
        ],
      },
      {
        id: 'third',
        title: '3. Cookies de terceros',
        paragraphs: [
          'Los proveedores OAuth (Google, GitHub) pueden establecer cookies al iniciar sesión en sus páginas.',
          'Stripe puede usar cookies durante el pago. Herramientas de analítica o soporte, si se activan, pueden establecer las suyas según sus políticas.',
        ],
      },
      {
        id: 'manage',
        title: '4. Gestión de cookies',
        paragraphs: [
          'Puede controlar las cookies en la configuración del navegador (bloquear, eliminar o avisar). Bloquear las necesarias puede impedir el inicio de sesión o funciones básicas.',
          'Puede retirar el consentimiento para cookies no esenciales borrando datos del sitio o usando nuestro banner de cookies cuando esté disponible.',
        ],
      },
      {
        id: 'duration',
        title: '5. Plazos de conservación',
        paragraphs: [
          'Las cookies de sesión expiran al cerrar el navegador. Las persistentes pueden durar hasta 12 meses salvo eliminación previa.',
          'Los registros de consentimiento pueden almacenarse localmente el mismo periodo para evitar avisos repetidos.',
        ],
      },
      {
        id: 'legal',
        title: '6. Base jurídica',
        paragraphs: [
          'Las cookies necesarias se basan en interés legítimo y ejecución del contrato. Las de preferencia u opcionales requieren consentimiento cuando la ley lo exija (p. ej. Directiva ePrivacy / RGPD).',
        ],
      },
      {
        id: 'liability',
        title: '7. Exención de responsabilidad',
        paragraphs: [
          `La información de esta política se ofrece con fines de transparencia. ${COMPANY} no es responsable de las prácticas de cookies de terceros ni de daños derivados de sus elecciones más allá de los límites legales obligatorios.`,
        ],
      },
      {
        id: 'changes',
        title: '8. Actualizaciones',
        paragraphs: [
          'Podemos actualizar esta Política de cookies periódicamente. Revise esta página con regularidad. La fecha superior indica la última revisión.',
        ],
      },
    ],
  },
  terms: {
    title: 'Términos del servicio',
    subtitle: 'Normas que rigen el acceso y uso de la plataforma.',
    lastUpdated: '18 de mayo de 2026',
    acceptanceNotice:
      `Al crear una cuenta, hacer clic en «Aceptar» o utilizar ${COMPANY}, acepta estos Términos del servicio y nuestra Política de privacidad. Si no está de acuerdo, no utilice el servicio. La plataforma se ofrece «tal cual»; la responsabilidad se limita según se indica a continuación.`,
    sections: [
      {
        id: 'service',
        title: '1. El servicio',
        paragraphs: [
          `${COMPANY} es una plataforma en navegador para especificación de software asistida por IA, generación de código, gestión de proyectos y funciones relacionadas, incluido marketplace e integraciones de despliegue opcionales.`,
          'Podemos modificar, suspender o discontinuar funciones con aviso razonable cuando sea posible.',
        ],
      },
      {
        id: 'account',
        title: '2. Cuentas',
        paragraphs: [
          'Debe registrarse con OAuth de GitHub o Google y proporcionar información veraz. Es responsable de proteger el acceso a sus cuentas OAuth y de toda actividad en su cuenta de Runlabs42.',
          'Debe tener al menos 16 años (o la edad mínima exigida en su jurisdicción) para usar el servicio.',
        ],
      },
      {
        id: 'acceptable',
        title: '3. Uso aceptable',
        paragraphs: [
          'No puede usar el servicio con fines ilícitos, para infringir propiedad intelectual, distribuir malware, acosar a terceros ni intentar accesos no autorizados a sistemas o datos.',
          'Es responsable de las indicaciones, el código y el contenido que genere o publique, incluido el cumplimiento de licencias de componentes de terceros.',
        ],
      },
      {
        id: 'ai',
        title: '4. Contenido generado por IA',
        paragraphs: [
          'Las salidas de modelos de IA pueden ser inexactas, incompletas o inadecuadas para producción. Debe revisar, probar y validar todo código y especificaciones antes de su uso.',
          `${COMPANY} no garantiza que las salidas de IA estén libres de errores, no infrinjan derechos ni sean aptas para un fin particular. Usted asume toda responsabilidad por el despliegue y las consecuencias del uso.`,
        ],
      },
      {
        id: 'ip',
        title: '5. Propiedad intelectual',
        paragraphs: [
          'Conservamos derechos sobre la plataforma, la marca y la tecnología subyacente. Sujeto a estos Términos, usted conserva derechos sobre sus proyectos y contenido, en la medida permitida por la ley y licencias de terceros.',
          'Nos otorga una licencia limitada para alojar, procesar y mostrar su contenido únicamente para operar y mejorar el servicio.',
        ],
      },
      {
        id: 'payment',
        title: '6. Pagos y créditos',
        paragraphs: [
          'Los planes de pago y paquetes de créditos se facturan mediante Stripe según los precios mostrados en la compra. Las tarifas no son reembolsables salvo obligación legal o indicación expresa.',
          'Los créditos pueden caducar o renovarse según las reglas del plan publicadas en la página de precios. Podemos cambiar precios con aviso.',
        ],
      },
      {
        id: 'warranty',
        title: '7. Exclusión de garantías',
        paragraphs: [
          `EL SERVICIO SE PRESTA «TAL CUAL» Y «SEGÚN DISPONIBILIDAD», SIN GARANTÍAS DE NINGÚN TIPO, EXPRESAS, IMPLÍCITAS O LEGALES, INCLUIDAS COMERCIABILIDAD, IDONEIDAD PARA UN FIN DETERMINADO Y NO INFRACCIÓN.`,
        ],
      },
      {
        id: 'liability',
        title: '8. Limitación de responsabilidad',
        paragraphs: [
          `EN LA MÁXIMA MEDIDA PERMITIDA POR LA LEY, ${COMPANY} Y SUS AFILIADOS, DIRECTORES, EMPLEADOS Y PROVEEDORES NO SERÁN RESPONSABLES DE DAÑOS INDIRECTOS, INCIDENTALES, ESPECIALES, CONSECUENCIALES O PUNITIVOS, NI DE PÉRDIDA DE BENEFICIOS, DATOS O FONDO DE COMERCIO DERIVADOS DEL USO DEL SERVICIO.`,
          `NUESTRA RESPONSABILIDAD TOTAL POR CUALQUIER RECLAMACIÓN NO SUPERARÁ EL MAYOR DE (A) LO ABONADO EN LOS DOCE MESES ANTERIORES AL RECLAMO O (B) CINCUENTA DÓLARES ESTADOUNIDENSES (50 USD), SALVO DONDE LA LEY NO PERMITA LIMITARLA.`,
        ],
      },
      {
        id: 'indemnity',
        title: '9. Indemnización',
        paragraphs: [
          'Usted se compromete a indemnizar y mantener indemne a Runlabs42 frente a reclamaciones derivadas de su contenido, incumplimiento de estos Términos o violación de la ley o derechos de terceros, en la medida permitida por la ley aplicable.',
        ],
      },
      {
        id: 'termination',
        title: '10. Resolución',
        paragraphs: [
          'Puede dejar de usar el servicio en cualquier momento. Podemos suspender o cancelar el acceso por incumplimiento de estos Términos, requisitos legales o riesgo para la plataforma u otros usuarios.',
          'Tras la resolución, subsistirán las cláusulas que por su naturaleza deban permanecer (límites de responsabilidad, indemnización, ley aplicable).',
        ],
      },
      {
        id: 'law',
        title: '11. Ley aplicable',
        paragraphs: [
          'Estos Términos se rigen por las leyes de España, sin tener en cuenta normas de conflicto de leyes, salvo que las normas imperativas de consumo de su país exijan otra cosa.',
          'Las disputas se someterán a los tribunales de España, salvo que las normas de la UE en materia de consumo le permitan acudir a los tribunales de su país de residencia.',
        ],
      },
      {
        id: 'changes',
        title: '12. Cambios',
        paragraphs: [
          'Podemos revisar estos Términos. Publicaremos la versión actualizada en esta página y actualizaremos la fecha superior. El uso continuado implica aceptación salvo prohibición legal.',
        ],
      },
    ],
  },
}
