#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/5af647ac3891cc93cda05c0ce3feaf01394a6ccfc44bd5dac359203dc890463b/contract';
import startContract from '../../snapshots/5af647ac3891cc93cda05c0ce3feaf01394a6ccfc44bd5dac359203dc890463b/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/cd8efc4988746130ae8688e2af165da01d27502c09ad5a4d06eebf39bce548d5/contract';
import endContract from '../../snapshots/cd8efc4988746130ae8688e2af165da01d27502c09ad5a4d06eebf39bce548d5/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'paragraph',
        column: col('isDeleted', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'paragraph',
        column: col('language', 'text', { default: lit('en'), codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
