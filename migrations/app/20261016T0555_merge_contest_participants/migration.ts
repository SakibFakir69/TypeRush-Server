#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/103fb4dbdd26b16cfa573d7138aac32f3eab4a1dc39d9ee5ab5e4cbf6183170b/contract';
import endContract from '../../snapshots/103fb4dbdd26b16cfa573d7138aac32f3eab4a1dc39d9ee5ab5e4cbf6183170b/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/b6e83e4ec0b628a95b4a52669453465ca4312430bd9bbd695762e994520ba86d/contract';
import startContract from '../../snapshots/b6e83e4ec0b628a95b4a52669453465ca4312430bd9bbd695762e994520ba86d/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'contest',
        columns: [
          col('content', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('time', 'float8', { notNull: true, codecRef: { codecId: 'pg/float8@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('userId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'contestParticipant',
        columns: [
          col('contestId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('joinedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['userId', 'contestId'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'contest',
        index: 'contest_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'contestParticipant',
        index: 'contestParticipant_contestId_idx_8a30d986',
        columns: ['contestId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'contestParticipant',
        index: 'contestParticipant_userId_contestId_idx_0208880e',
        columns: ['userId', 'contestId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'contestParticipant',
        index: 'contestParticipant_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'contest',
        foreignKey: {
          name: 'contest_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'contestParticipant',
        foreignKey: {
          name: 'contestParticipant_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'contestParticipant',
        foreignKey: {
          name: 'contestParticipant_contestId_fkey',
          columns: ['contestId'],
          references: { schema: 'public', table: 'contest', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
