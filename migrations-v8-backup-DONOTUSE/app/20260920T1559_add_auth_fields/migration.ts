#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/498ea7701503b4fd1f7e6bf9ccbe6580295ed9a9ac8d5ddfda5db65e2c557ef3/contract';
import startContract from '../../snapshots/498ea7701503b4fd1f7e6bf9ccbe6580295ed9a9ac8d5ddfda5db65e2c557ef3/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e036ab2e8648db13e07858cf34c0b43fe4556097c356e00ffe7afcc6b0226da0/contract';
import endContract from '../../snapshots/e036ab2e8648db13e07858cf34c0b43fe4556097c356e00ffe7afcc6b0226da0/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('authProvider', 'text', {
          notNull: true,
          default: lit('local'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('emailVerified', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('googleId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.dropNotNull({ schema: 'public', table: 'user', column: 'country' }),
      this.dropNotNull({ schema: 'public', table: 'user', column: 'password' }),
      this.addUnique({
        schema: 'public',
        table: 'user',
        constraint: 'user_googleId_key',
        columns: ['googleId'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
