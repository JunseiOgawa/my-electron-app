import { PrismaClient } from '@prisma/client';
import { Schedule, ScheduleData, ChatMemo } from '../types';

export class Database {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async getSchedules(): Promise<Schedule[]> {
    try {
      const schedules = await this.prisma.schedule.findMany();
      return schedules.map((schedule) => ({
        id: schedule.id.toString(),
        title: schedule.title,
        content: schedule.content,
        start: schedule.start ? schedule.start.toISOString() : '',
        end: schedule.end ? schedule.end.toISOString() : '',
        group: schedule.group,
        style: schedule.style,
        remind: Boolean(schedule.remind),
      }));
    } catch (error) {
      console.error('スケジュールの取得に失敗しました:', error);
      throw error;
    }
  }

  async saveSchedules(schedules: Schedule[]): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        // 既存レコードを取得
        const existingSchedules = await tx.schedule.findMany({
          select: { id: true },
        });
        const existingIds = new Set(existingSchedules.map((s) => s.id));

        // 各スケジュールを処理
        for (const item of schedules) {
          const scheduleData = {
            title: item.title || '',
            content: item.content || '',
            start: new Date(item.start),
            end: new Date(item.end),
            group: item.group || 1,
            style: item.style || 'background-color: #4CAF50;',
            remind: item.remind || false,
            notified: false,
          };

          if (existingIds.has(item.id)) {
            await tx.schedule.update({
              where: { id: item.id },
              data: scheduleData,
            });
          } else {
            await tx.schedule.create({
              data: {
                id: item.id,
                ...scheduleData,
              },
            });
          }
        }

        // 削除されたレコードの処理
        const newIds = new Set(schedules.map((item) => item.id));
        const idsToDelete = [...existingIds].filter((id) => !newIds.has(id));

        if (idsToDelete.length > 0) {
          await tx.schedule.deleteMany({
            where: {
              id: {
                in: idsToDelete,
              },
            },
          });
        }
      });
    } catch (error) {
      console.error('スケジュールの保存に失敗しました:', error);
      throw error;
    }
  }

  async deleteSchedule(id: string): Promise<void> {
    try {
      await this.prisma.schedule.delete({
        where: { id: BigInt(id) as any },
      });
    } catch (error) {
      console.error('スケジュールの削除に失敗しました:', error);
      throw error;
    }
  }

  async getChatMemos(): Promise<ChatMemo[]> {
    try {
      const memos = await this.prisma.chatMemo.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          message: true,
          createdAt: true,
        },
      });
      return memos.map((memo) => ({
        id: memo.id,
        message: memo.message,
        createdAt: memo.createdAt.toISOString(),
      }));
    } catch (error) {
      console.error('メモの取得に失敗しました:', error);
      throw error;
    }
  }

  async saveChatMemo(message: string): Promise<ChatMemo> {
    try {
      const newMemo = await this.prisma.chatMemo.create({
        data: {
          message: message,
          createdAt: new Date(),
        },
      });
      return {
        id: newMemo.id,
        message: newMemo.message,
        createdAt: newMemo.createdAt.toISOString(),
      };
    } catch (error) {
      console.error('メモの保存に失敗しました:', error);
      throw error;
    }
  }

  async getRemindSchedules(remindIntervalMinutes: number): Promise<ScheduleData[]> {
    try {
      const now = new Date();
      const schedules = await this.prisma.schedule.findMany({
        where: {
          start: {
            gte: new Date(now.getTime() + 60000),
            lte: new Date(now.getTime() + remindIntervalMinutes * 60000),
          },
          notified: false,
          remind: true,
        },
      });
      return schedules.map((schedule) => ({
        id: schedule.id.toString(),
        title: schedule.title,
        content: schedule.content,
        start: schedule.start,
        end: schedule.end,
        group: schedule.group,
        style: schedule.style,
        remind: Boolean(schedule.remind),
        notified: Boolean(schedule.notified),
      }));
    } catch (error) {
      console.error('リマインドスケジュールの取得に失敗しました:', error);
      throw error;
    }
  }

  async markSchedulesAsNotified(ids: string[]): Promise<void> {
    try {
      await this.prisma.schedule.updateMany({
        where: {
          id: {
            in: ids,
          },
        },
        data: {
          notified: true,
        },
      });
    } catch (error) {
      console.error('スケジュールの通知済み更新に失敗しました:', error);
      throw error;
    }
  }
}

export const database = new Database();
