#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/13050c9e3a341dd940ebe0b31cb99b2b21571944f6aa1a209fb43bd00885190a/contract';
import startContract from '../../snapshots/13050c9e3a341dd940ebe0b31cb99b2b21571944f6aa1a209fb43bd00885190a/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/b6e83e4ec0b628a95b4a52669453465ca4312430bd9bbd695762e994520ba86d/contract';
import endContract from '../../snapshots/b6e83e4ec0b628a95b4a52669453465ca4312430bd9bbd695762e994520ba86d/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('role', 'text', {
          notNull: true,
          default: lit('USER'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'user',
        constraint: 'user_role_check_7d146180',
        expression: "\"role\" IN ('ADMIN', 'USER', 'ORG')",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
