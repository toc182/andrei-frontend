import React from 'react';
import logo from '../assets/logo.png';

/**
 * La política de privacidad del sistema, en una dirección pública.
 *
 * Existe porque Meta la exige para publicar la aplicación de WhatsApp, y quien
 * la lee es alguien de fuera: por eso no vive detrás del login, no usa el
 * marco de la app y se explica sin nombres internos.
 */
const ACTUALIZADA = '24 de septiembre de 2026';

const Seccion: React.FC<{ titulo: string; children: React.ReactNode }> = ({
  titulo,
  children,
}) => (
  <section className="space-y-2">
    <h2 className="text-lg font-semibold border-l-2 border-primary pl-3 text-foreground">
      {titulo}
    </h2>
    <div className="space-y-2 text-muted-foreground">{children}</div>
  </section>
);

const PrivacidadPublica: React.FC = () => (
  <div className="min-h-screen bg-muted/30 py-10 px-4">
    <div className="max-w-3xl mx-auto space-y-8">
      <header className="space-y-3">
        <img src={logo} alt="Pinellas" className="h-12" />
        <h1 className="text-2xl font-bold text-foreground">
          Política de privacidad
        </h1>
        <p className="text-sm text-muted-foreground">
          Sistema interno de Pinellas, S.A. · Actualizada el {ACTUALIZADA}
        </p>
      </header>

      <Seccion titulo="Para quién es este sistema">
        <p>
          Pinellas, S.A. es una empresa constructora de Panamá. Este sistema y su
          asistente de WhatsApp son herramientas internas de trabajo: los usan el
          personal de la empresa y las personas que colaboran en sus obras. No es
          un servicio abierto al público ni se ofrece a terceros.
        </p>
      </Seccion>

      <Seccion titulo="Qué datos se guardan">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            De cada usuario: nombre, correo, cargo, el número de WhatsApp que la
            empresa registra para él y lo que hace dentro del sistema.
          </li>
          <li>
            Del asistente de WhatsApp: los mensajes que la persona escribe al
            número de la empresa, las fotos que manda y las respuestas que recibe.
          </li>
          <li>
            De la obra: reportes diarios y semanales, avances, equipos,
            materiales, documentos y los archivos que se adjuntan.
          </li>
        </ul>
      </Seccion>

      <Seccion titulo="Para qué se usan">
        <p>
          Únicamente para operar la empresa: redactar y enviar los reportes de
          obra, llevar el control de los proyectos y los pagos, y dejar
          constancia de quién hizo cada cosa. No se usan para publicidad y no se
          venden ni se ceden a nadie.
        </p>
      </Seccion>

      <Seccion titulo="Quién más los procesa">
        <p>
          El sistema se apoya en proveedores que tratan estos datos solo para
          que funcione: WhatsApp (Meta) para los mensajes, Anthropic para el
          asistente que ayuda a redactar el reporte, Railway y Cloudflare para
          los servidores y el almacenamiento de archivos, y Resend para el envío
          de correos.
        </p>
      </Seccion>

      <Seccion titulo="Cuánto tiempo se conservan">
        <p>
          Los reportes y documentos de obra se conservan mientras el proyecto lo
          requiera y por el tiempo que exige la ley. Las conversaciones de
          WhatsApp se guardan como respaldo del reporte que originaron.
        </p>
      </Seccion>

      <Seccion titulo="Sus derechos">
        <p>
          Cualquier persona puede pedir qué datos suyos hay guardados, que se
          corrijan o que se eliminen, salvo los que la empresa deba conservar por
          obligación legal. La solicitud se hace por correo a{' '}
          <a
            className="text-primary underline"
            href="mailto:info@pinellaspanama.com"
          >
            info@pinellaspanama.com
          </a>
          .
        </p>
      </Seccion>

      <Seccion titulo="Contacto">
        <p>
          Pinellas, S.A. · Urb. Los Ángeles, Calle 63A, D12, Panamá ·{' '}
          <a
            className="text-primary underline"
            href="mailto:info@pinellaspanama.com"
          >
            info@pinellaspanama.com
          </a>
        </p>
      </Seccion>
    </div>
  </div>
);

export default PrivacidadPublica;
