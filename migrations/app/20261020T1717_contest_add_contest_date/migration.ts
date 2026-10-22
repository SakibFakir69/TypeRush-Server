#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/4efdb783719d547b27575e3327bd2aacd099ab2c8ee6fe621e55f219f7eb6ed3/contract';
import startContract from '../../snapshots/4efdb783719d547b27575e3327bd2aacd099ab2c8ee6fe621e55f219f7eb6ed3/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/5af647ac3891cc93cda05c0ce3feaf01394a6ccfc44bd5dac359203dc890463b/contract';
import endContract from '../../snapshots/5af647ac3891cc93cda05c0ce3feaf01394a6ccfc44bd5dac359203dc890463b/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'announcement',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('message', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('userId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'contest',
        column: col('contestDate', 'timestamptz', {
          notNull: true,
          default: fn('now()'),
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'announcement',
        index: 'announcement_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'announcement',
        foreignKey: {
          name: 'announcement_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
