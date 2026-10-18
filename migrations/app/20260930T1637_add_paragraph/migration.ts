#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/13050c9e3a341dd940ebe0b31cb99b2b21571944f6aa1a209fb43bd00885190a/contract';
import endContract from '../../snapshots/13050c9e3a341dd940ebe0b31cb99b2b21571944f6aa1a209fb43bd00885190a/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e036ab2e8648db13e07858cf34c0b43fe4556097c356e00ffe7afcc6b0226da0/contract';
import startContract from '../../snapshots/e036ab2e8648db13e07858cf34c0b43fe4556097c356e00ffe7afcc6b0226da0/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  col,
  fn,
  placeholder,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'paragraph',
        columns: [
          col('category', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('content', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('difficulty', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('wordCount', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'result',
        columns: [
          col('accuracy', 'float8', { notNull: true, codecRef: { codecId: 'pg/float8@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('errors', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('paragraphId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('timeTaken', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('userId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('wpm', 'float8', { notNull: true, codecRef: { codecId: 'pg/float8@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.dataTransform(endContract, 'handle-nulls-user-isDelete', {
        check: () => placeholder('handle-nulls-user-isDelete:check'),
        run: () => placeholder('handle-nulls-user-isDelete:run'),
      }),
      this.setNotNull({ schema: 'public', table: 'user', column: 'isDelete' }),
      this.createIndex({
        schema: 'public',
        table: 'result',
        index: 'result_paragraphId_idx_2e981790',
        columns: ['paragraphId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'result',
        index: 'result_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'result',
        foreignKey: {
          name: 'result_paragraphId_fkey',
          columns: ['paragraphId'],
          references: { schema: 'public', table: 'paragraph', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'result',
        foreignKey: {
          name: 'result_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
