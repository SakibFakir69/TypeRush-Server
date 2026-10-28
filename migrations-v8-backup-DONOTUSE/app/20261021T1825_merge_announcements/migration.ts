#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/5af647ac3891cc93cda05c0ce3feaf01394a6ccfc44bd5dac359203dc890463b/contract';
import endContract from '../../snapshots/5af647ac3891cc93cda05c0ce3feaf01394a6ccfc44bd5dac359203dc890463b/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/954df7fbf3120a09fd9303032700418c7b8e0761e487b8b87d8484a24382a4c5/contract';
import startContract from '../../snapshots/954df7fbf3120a09fd9303032700418c7b8e0761e487b8b87d8484a24382a4c5/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'contest',
        column: col('contestDate', 'timestamptz', {
          notNull: true,
          default: fn('now()'),
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
