import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Real-time channel (deliverable 6, server side).
 *
 * Rooms: `farm:{farmId}` — one per tenant. Events pushed:
 *   kpi:update   farm-level KPI snapshot after any daily record write
 *   alert:new    a new Alert row (mortality spike, low stock, temp…)
 *   sensor:new   a temp/humidity reading
 *
 * Clients connect with `auth: { token }` (the same access JWT as REST) and
 * emit `join` with a farmId; membership is verified before joining the room.
 */
@Injectable()
@WebSocketGateway({
  cors: { origin: (process.env.CORS_ORIGINS ?? '').split(',') },
})
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(socket: Socket) {
    try {
      const payload = await this.jwt.verifyAsync(
        socket.handshake.auth?.token ?? '',
        { secret: process.env.JWT_SECRET },
      );
      socket.data.userId = payload.sub;
    } catch {
      socket.disconnect(true);
    }
  }

  @SubscribeMessage('join')
  async join(socket: Socket, farmId: string) {
    const member = await this.prisma.farmMember.findUnique({
      where: { farmId_userId: { farmId, userId: socket.data.userId } },
    });
    if (!member) {
      socket.emit('error', 'not a member of this farm');
      return;
    }
    await socket.join(`farm:${farmId}`);
    socket.emit('joined', farmId);
  }

  @SubscribeMessage('leave')
  leave(socket: Socket, farmId: string) {
    socket.leave(`farm:${farmId}`);
  }

  /** Called by RecordsService / AlertsService / InventoryService. */
  emitToFarm(farmId: string, event: string, payload: unknown) {
    this.server?.to(`farm:${farmId}`).emit(event, payload);
    this.logger.debug(`→ farm:${farmId} ${event}`);
  }
}
