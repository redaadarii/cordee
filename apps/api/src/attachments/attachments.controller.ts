import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { UserId } from '../common/auth.js';
import { env } from '../config/env.js';
import { AttachmentsService } from './attachments.service.js';

@Controller()
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Post('issues/:issueId/attachments')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 } }))
  upload(
    @UserId() userId: string,
    @Param('issueId', ParseUUIDPipe) issueId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.attachments.upload(userId, issueId, file);
  }

  @Get('attachments/:attachmentId')
  async download(
    @UserId() userId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { attachment, stream } = await this.attachments.open(userId, attachmentId);
    // Toujours en téléchargement, jamais affiché dans l'origine de l'application :
    // un fichier HTML envoyé par un membre ne peut pas s'exécuter avec la session d'un autre.
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
      'Content-Length': String(attachment.size),
    });
    return new StreamableFile(stream);
  }

  @HttpCode(204)
  @Delete('attachments/:attachmentId')
  remove(@UserId() userId: string, @Param('attachmentId', ParseUUIDPipe) attachmentId: string) {
    return this.attachments.remove(userId, attachmentId);
  }
}
