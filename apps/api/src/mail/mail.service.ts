import { Injectable, Logger } from '@nestjs/common';
import { appendFile } from 'node:fs/promises';
import { createTransport, type Transporter } from 'nodemailer';
import { env } from '../config/env.js';

interface Mail {
  to: string;
  subject: string;
  text: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter | null = env.SMTP_URL ? createTransport(env.SMTP_URL) : null;

  async send(mail: Mail): Promise<void> {
    if (this.transport) {
      // Un envoi raté ne doit pas faire échouer la requête : l'utilisateur peut redemander le lien.
      await this.transport
        .sendMail({ from: env.MAIL_FROM, ...mail })
        .catch((error) => this.logger.error(`Envoi à ${mail.to} impossible : ${String(error)}`));
      return;
    }

    this.logger.log(`E-mail non envoyé (SMTP_URL absent)\nÀ : ${mail.to}\nObjet : ${mail.subject}\n\n${mail.text}`);
    if (env.MAIL_OUTBOX_FILE) {
      await appendFile(env.MAIL_OUTBOX_FILE, JSON.stringify(mail) + '\n');
    }
  }
}
