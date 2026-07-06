import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Writes an AuditLog row for every successful mutating request.
 * Fire-and-forget: an audit failure must never fail the request,
 * so errors are logged and swallowed.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    if (!MUTATING.has(req.method) || req.path.startsWith('/webhooks')) {
      return next.handle();
    }

    return next.handle().pipe(
      tap((result: any) => {
        this.prisma.auditLog
          .create({
            data: {
              farmId: req.params?.farmId ?? null,
              userId: req.user?.id ?? null,
              action: `${req.method} ${req.route?.path ?? req.path}`,
              entity: result?.constructor?.name ?? null,
              entityId: result?.id ?? req.params?.id ?? null,
              summary: JSON.stringify(req.body ?? {}).slice(0, 500),
              ip: req.ip,
            },
          })
          .catch((err) => console.error('audit write failed', err));
      }),
    );
  }
}
