#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/103fb4dbdd26b16cfa573d7138aac32f3eab4a1dc39d9ee5ab5e4cbf6183170b/contract';
import startContract from '../../snapshots/103fb4dbdd26b16cfa573d7138aac32f3eab4a1dc39d9ee5ab5e4cbf6183170b/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/4efdb783719d547b27575e3327bd2aacd099ab2c8ee6fe621e55f219f7eb6ed3/contract';
import endContract from '../../snapshots/4efdb783719d547b27575e3327bd2aacd099ab2c8ee6fe621e55f219f7eb6ed3/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'contest',
        column: col('condition', 'text', {
          notNull: true,
          default: lit('UPCOMING'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'contest',
        constraint: 'contest_condition_check_2acdb471',
        expression: "\"condition\" IN ('RUNNING', 'FINISHED', 'UPCOMING')",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
